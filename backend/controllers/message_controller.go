package controllers

import (
	"context"
	"line/config"
	"line/models"
	"line/sockets"
	"line/utils"
	"net/http"
	"strings"
	"time"

	"fmt"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

func GetRoomMessages(c *gin.Context) {
	roomID := c.Param("id")
	before := c.Query("before")
	limit := 50

	rid, err := primitive.ObjectIDFromHex(roomID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid room ID"})
		return
	}

	// Build the aggregation pipeline
	pipeline := []bson.M{
		{"$match": bson.M{"roomId": rid}},
	}

	if before != "" {
		bid, err := primitive.ObjectIDFromHex(before)
		if err == nil {
			pipeline = append(pipeline, bson.M{"$match": bson.M{"_id": bson.M{"$lt": bid}}})
		}
	}

	pipeline = append(pipeline,
		bson.M{"$sort": bson.M{"timestamp": -1}},
		bson.M{"$limit": limit},
		// Lookup for replied message
		bson.M{
			"$lookup": bson.M{
				"from":         "messages",
				"localField":   "replyTo",
				"foreignField": "_id",
				"as":           "repliedMessageDocs",
			},
		},
		// Lookup for sender of replied message
		bson.M{
			"$lookup": bson.M{
				"from":         "users",
				"localField":   "repliedMessageDocs.senderId",
				"foreignField": "_id",
				"as":           "repliedMessageSenders",
			},
		},
		// Add fields to shape the output
		bson.M{
			"$addFields": bson.M{
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
			},
		},
		// Project the final fields
		bson.M{
			"$project": bson.M{
				"repliedMessageDocs":    0,
				"repliedMessageSenders": 0,
			},
		},
		// Sort back to ascending for display
		bson.M{"$sort": bson.M{"timestamp": 1}},
	)

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	cursor, err := config.DB.Collection("messages").Aggregate(ctx, pipeline)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "DB aggregation error"})
		return
	}

	var messages []models.Message
	if err = cursor.All(ctx, &messages); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "DB cursor error"})
		return
	}

	c.JSON(http.StatusOK, messages)
}

// Mark all messages in a room as read by the current user
func MarkRoomMessagesRead(c *gin.Context) {
	roomID := c.Param("id")
	token := c.GetHeader("Authorization")
	if token != "" {
		token = strings.TrimPrefix(token, "Bearer ")
	}
	if token == "" {
		fmt.Println("Missing token")
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Missing token"})
		return
	}
	userID, err := utils.ParseJWT(token)
	if err != nil {
		fmt.Println("Invalid token:", err)
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token"})
		return
	}
	uid, err := primitive.ObjectIDFromHex(userID)
	if err != nil {
		fmt.Println("Invalid user ID in token:", err)
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid user ID in token"})
		return
	}
	rid, err := primitive.ObjectIDFromHex(roomID)
	if err != nil {
		fmt.Println("Invalid room ID:", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid room ID"})
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_, err = config.DB.Collection("messages").UpdateMany(ctx, bson.M{"roomId": rid, "readBy": bson.M{"$ne": uid}}, bson.M{"$addToSet": bson.M{"readBy": uid}})
	if err != nil {
		fmt.Println("DB error in MarkRoomMessagesRead:", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "DB error", "details": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Marked as read"})
}

// Pin a message
func PinMessage(c *gin.Context) {
	msgId := c.Param("msgId")
	id, err := primitive.ObjectIDFromHex(msgId)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid message ID"})
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_, err = config.DB.Collection("messages").UpdateByID(ctx, id, bson.M{"$set": bson.M{"pinned": true}})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "DB error"})
		return
	}
	var msg models.Message
	_ = config.DB.Collection("messages").FindOne(ctx, bson.M{"_id": id}).Decode(&msg)
	roomId := msg.RoomID.Hex()
	sockets.H.Pin <- sockets.PinEvent{Type: "pin", RoomID: roomId, MessageID: msgId, Message: msg}
	c.JSON(http.StatusOK, gin.H{"message": "Pinned"})
}

// Unpin a message
func UnpinMessage(c *gin.Context) {
	msgId := c.Param("msgId")
	id, err := primitive.ObjectIDFromHex(msgId)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid message ID"})
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_, err = config.DB.Collection("messages").UpdateByID(ctx, id, bson.M{"$set": bson.M{"pinned": false}})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "DB error"})
		return
	}
	var msg models.Message
	_ = config.DB.Collection("messages").FindOne(ctx, bson.M{"_id": id}).Decode(&msg)
	roomId := msg.RoomID.Hex()
	sockets.H.Pin <- sockets.PinEvent{Type: "unpin", RoomID: roomId, MessageID: msgId, Message: msg}
	c.JSON(http.StatusOK, gin.H{"message": "Unpinned"})
}

// Star a message
func StarMessage(c *gin.Context) {
	msgId := c.Param("msgId")
	token := c.GetHeader("Authorization")
	if token != "" {
		token = strings.TrimPrefix(token, "Bearer ")
	}
	userID, err := utils.ParseJWT(token)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token"})
		return
	}
	uid, err := primitive.ObjectIDFromHex(userID)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid user ID in token"})
		return
	}
	id, err := primitive.ObjectIDFromHex(msgId)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid message ID"})
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_, err = config.DB.Collection("messages").UpdateByID(ctx, id, bson.M{"$addToSet": bson.M{"starredBy": uid}})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "DB error"})
		return
	}
	var msg models.Message
	_ = config.DB.Collection("messages").FindOne(ctx, bson.M{"_id": id}).Decode(&msg)
	roomId := msg.RoomID.Hex()
	sockets.H.Star <- sockets.StarEvent{Type: "star", RoomID: roomId, MessageID: msgId, Message: msg}
	c.JSON(http.StatusOK, gin.H{"message": "Starred"})
}

// Unstar a message
func UnstarMessage(c *gin.Context) {
	msgId := c.Param("msgId")
	token := c.GetHeader("Authorization")
	if token != "" {
		token = strings.TrimPrefix(token, "Bearer ")
	}
	userID, err := utils.ParseJWT(token)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token"})
		return
	}
	uid, err := primitive.ObjectIDFromHex(userID)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid user ID in token"})
		return
	}
	id, err := primitive.ObjectIDFromHex(msgId)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid message ID"})
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_, err = config.DB.Collection("messages").UpdateByID(ctx, id, bson.M{"$pull": bson.M{"starredBy": uid}})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "DB error"})
		return
	}
	var msg models.Message
	_ = config.DB.Collection("messages").FindOne(ctx, bson.M{"_id": id}).Decode(&msg)
	roomId := msg.RoomID.Hex()
	sockets.H.Star <- sockets.StarEvent{Type: "unstar", RoomID: roomId, MessageID: msgId, Message: msg}
	c.JSON(http.StatusOK, gin.H{"message": "Unstarred"})
}

// Delete a message
func DeleteMessage(c *gin.Context) {
	msgId := c.Param("msgId")
	id, err := primitive.ObjectIDFromHex(msgId)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid message ID"})
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	var msg models.Message
	_ = config.DB.Collection("messages").FindOne(ctx, bson.M{"_id": id}).Decode(&msg)
	roomId := msg.RoomID.Hex()
	_, err = config.DB.Collection("messages").DeleteOne(ctx, bson.M{"_id": id})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "DB error"})
		return
	}
	sockets.H.Delete <- sockets.DeleteEvent{Type: "delete", RoomID: roomId, MessageID: msgId}
	c.JSON(http.StatusOK, gin.H{"message": "Deleted"})
}

// Forward a message to another room
func ForwardMessage(c *gin.Context) {
	msgId := c.Param("msgId")
	var req struct {
		ToRoomId string `json:"toRoomId"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input"})
		return
	}
	id, err := primitive.ObjectIDFromHex(msgId)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid message ID"})
		return
	}
	toRoomId, err := primitive.ObjectIDFromHex(req.ToRoomId)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid room ID"})
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	var orig models.Message
	err = config.DB.Collection("messages").FindOne(ctx, bson.M{"_id": id}).Decode(&orig)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Original message not found"})
		return
	}
	newMsg := models.Message{
		RoomID:    toRoomId,
		SenderID:  orig.SenderID,
		Content:   orig.Content,
		MediaURL:  orig.MediaURL,
		Timestamp: time.Now(),
		ReadBy:    []primitive.ObjectID{},
		Reactions: map[string][]primitive.ObjectID{},
		Pinned:    false,
		StarredBy: []primitive.ObjectID{},
	}
	res, err := config.DB.Collection("messages").InsertOne(ctx, newMsg)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "DB error"})
		return
	}
	newMsg.ID = res.InsertedID.(primitive.ObjectID)
	sockets.H.Forward <- sockets.ForwardEvent{Type: "forward", RoomID: req.ToRoomId, MessageID: newMsg.ID.Hex(), Message: newMsg}
	c.JSON(http.StatusOK, gin.H{"message": "Forwarded"})
}
