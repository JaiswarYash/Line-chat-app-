package sockets

import (
	"context"
	"encoding/json"
	"line/config"
	"line/models"
	"time"

	"github.com/gorilla/websocket"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// Client represents a WebSocket client
type Client struct {
	Conn   *websocket.Conn
	UserID string
	RoomID string
	Send   chan interface{}
}

type MessageEvent struct {
	Type           string                     `json:"type"`
	ID             string                     `json:"id"`
	ClientSideID   string                     `json:"clientSideId,omitempty"`
	RoomID         string                     `json:"roomId"`
	SenderID       string                     `json:"senderId"`
	Content        string                     `json:"content"`
	MediaURL       string                     `json:"mediaUrl,omitempty"`
	Timestamp      time.Time                  `json:"timestamp"`
	ReplyTo        string                     `json:"replyTo,omitempty"`
	RepliedMessage *models.RepliedMessageInfo `json:"repliedMessage,omitempty"`
}

type TypingEvent struct {
	Type   string `json:"type"`
	RoomID string `json:"roomId"`
	UserID string `json:"userId"`
}

type PresenceEvent struct {
	Type   string `json:"type"`
	RoomID string `json:"roomId"`
	UserID string `json:"userId"`
	Status string `json:"status"`
}

type ReactionEvent struct {
	Type      string `json:"type"`
	RoomID    string `json:"roomId"`
	MessageID string `json:"messageId"`
	Emoji     string `json:"emoji"`
	UserID    string `json:"userId"`
}

type PinEvent struct {
	Type      string         `json:"type"`
	RoomID    string         `json:"roomId"`
	MessageID string         `json:"messageId"`
	Message   models.Message `json:"message"`
}

type StarEvent struct {
	Type      string         `json:"type"`
	RoomID    string         `json:"roomId"`
	MessageID string         `json:"messageId"`
	Message   models.Message `json:"message"`
}

type DeleteEvent struct {
	Type      string `json:"type"`
	RoomID    string `json:"roomId"`
	MessageID string `json:"messageId"`
}

type ForwardEvent struct {
	Type      string         `json:"type"`
	RoomID    string         `json:"roomId"`
	MessageID string         `json:"messageId"`
	Message   models.Message `json:"message"`
}

// ReadPump reads messages from the WebSocket connection
func (c *Client) ReadPump() {
	defer func() {
		c.Conn.Close()
	}()

	for {
		_, message, err := c.Conn.ReadMessage()
		if err != nil {
			break
		}

		var event map[string]interface{}
		if err := json.Unmarshal(message, &event); err != nil {
			continue
		}

		switch event["type"] {
		case "message":
			roomID := event["roomId"].(string)
			content := event["content"].(string)
			mediaURL := ""
			if val, ok := event["mediaUrl"].(string); ok {
				mediaURL = val
			}
			replyTo := ""
			if val, ok := event["replyTo"].(string); ok {
				replyTo = val
			}
			clientSideID := ""
			if id, ok := event["clientSideId"].(string); ok {
				clientSideID = id
			}

			// Save to DB
			rid, _ := primitive.ObjectIDFromHex(roomID)
			sid, _ := primitive.ObjectIDFromHex(c.UserID)
			newMsg := models.Message{
				RoomID:    rid,
				SenderID:  sid,
				Content:   content,
				MediaURL:  mediaURL,
				Timestamp: time.Now(),
				ReadBy:    []primitive.ObjectID{},
				Reactions: map[string][]primitive.ObjectID{},
			}

			if replyTo != "" {
				replyToID, err := primitive.ObjectIDFromHex(replyTo)
				if err == nil {
					newMsg.ReplyTo = &replyToID
				}
			}

			res, err := config.DB.Collection("messages").InsertOne(context.Background(), newMsg)
			if err != nil {
				// Handle insert error
				continue
			}
			newMsgID := res.InsertedID.(primitive.ObjectID)

			// Use aggregation to fetch the full message details to ensure consistency
			pipeline := []bson.M{
				{"$match": bson.M{"_id": newMsgID}},
				{"$limit": 1},
				{"$lookup": bson.M{"from": "messages", "localField": "replyTo", "foreignField": "_id", "as": "repliedMessageDocs"}},
				{"$lookup": bson.M{"from": "users", "localField": "repliedMessageDocs.senderId", "foreignField": "_id", "as": "repliedMessageSenders"}},
				{"$addFields": bson.M{
					"repliedMessage": bson.M{
						"$cond": bson.M{
							"if": bson.M{"$gt": bson.A{bson.M{"$size": "$repliedMessageDocs"}, 0}},
							"then": bson.M{
								"senderId":   bson.M{"$toString": bson.M{"$arrayElemAt": bson.A{"$repliedMessageDocs.senderId", 0}}},
								"senderName": bson.M{"$arrayElemAt": bson.A{"$repliedMessageSenders.username", 0}},
								"content":    bson.M{"$arrayElemAt": bson.A{"$repliedMessageDocs.content", 0}},
								"mediaUrl":   bson.M{"$arrayElemAt": bson.A{"$repliedMessageDocs.mediaUrl", 0}},
							},
							"else": nil,
						},
					},
				}},
				{"$project": bson.M{"repliedMessageDocs": 0, "repliedMessageSenders": 0}},
			}

			ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
			defer cancel()

			cursor, err := config.DB.Collection("messages").Aggregate(ctx, pipeline)
			if err != nil {
				continue // handle error
			}
			var fullMessages []models.Message
			if err = cursor.All(ctx, &fullMessages); err != nil || len(fullMessages) == 0 {
				continue // handle error
			}
			fullMessage := fullMessages[0]

			// Create message event for broadcast
			msgEvent := MessageEvent{
				Type:           "message",
				ID:             fullMessage.ID.Hex(),
				ClientSideID:   clientSideID,
				RoomID:         fullMessage.RoomID.Hex(),
				SenderID:       fullMessage.SenderID.Hex(),
				Content:        fullMessage.Content,
				MediaURL:       fullMessage.MediaURL,
				Timestamp:      fullMessage.Timestamp,
				RepliedMessage: fullMessage.RepliedMessage,
			}
			if fullMessage.ReplyTo != nil {
				msgEvent.ReplyTo = fullMessage.ReplyTo.Hex()
			}

			H.Broadcast <- msgEvent
		case "typing":
			roomID := event["roomId"].(string)
			H.Typing <- TypingEvent{Type: "typing", RoomID: roomID, UserID: c.UserID}
		case "reaction":
			roomID := event["roomId"].(string)
			messageID := event["messageId"].(string)
			emoji := event["emoji"].(string)
			userID := c.UserID
			// Update message in DB
			mid, _ := primitive.ObjectIDFromHex(messageID)
			var msg models.Message
			err := config.DB.Collection("messages").FindOne(context.Background(), bson.M{"_id": mid}).Decode(&msg)
			if err == nil {
				if msg.Reactions == nil {
					msg.Reactions = make(map[string][]primitive.ObjectID)
				}
				uid, _ := primitive.ObjectIDFromHex(userID)
				found := false
				for _, id := range msg.Reactions[emoji] {
					if id == uid {
						found = true
						break
					}
				}
				if !found {
					msg.Reactions[emoji] = append(msg.Reactions[emoji], uid)
				} else {
					// Remove reaction
					newArr := []primitive.ObjectID{}
					for _, id := range msg.Reactions[emoji] {
						if id != uid {
							newArr = append(newArr, id)
						}
					}
					if len(newArr) == 0 {
						delete(msg.Reactions, emoji)
					} else {
						msg.Reactions[emoji] = newArr
					}
				}
				config.DB.Collection("messages").UpdateOne(context.Background(), bson.M{"_id": mid}, bson.M{"$set": bson.M{"reactions": msg.Reactions}})
				H.Reaction <- ReactionEvent{
					Type:      "reaction",
					RoomID:    roomID,
					MessageID: messageID,
					Emoji:     emoji,
					UserID:    userID,
				}
			}
		}
	}
}

// WritePump writes messages to the WebSocket connection
func (c *Client) WritePump() {
	for msg := range c.Send {
		c.Conn.WriteJSON(msg)
	}
}
