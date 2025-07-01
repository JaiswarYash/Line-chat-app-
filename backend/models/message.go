package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// RepliedMessageInfo represents the information about a message being replied to
type RepliedMessageInfo struct {
	SenderID   string `json:"senderId"`
	SenderName string `json:"senderName"`
	Content    string `json:"content"`
	MediaURL   string `json:"mediaUrl,omitempty"`
}

// Message represents a chat message in a room
// ID is the MongoDB ObjectID
// RoomID is the room this message belongs to
// SenderID is the user who sent the message
// ReplyTo is a pointer to the ID of the message this message is replying to
// Content is the text content
// MediaURL is the optional media file URL
// Timestamp is when the message was sent
// ReadBy is a list of user IDs who have read the message
// Reactions is a map from emoji to user IDs who reacted
// Pinned is a boolean indicating whether the message is pinned
// StarredBy is a list of user IDs who have starred the message
type Message struct {
	ID             primitive.ObjectID              `bson:"_id,omitempty" json:"id"`
	RoomID         primitive.ObjectID              `bson:"roomId" json:"roomId"`
	SenderID       primitive.ObjectID              `bson:"senderId" json:"senderId"`
	ReplyTo        *primitive.ObjectID             `bson:"replyTo,omitempty" json:"replyTo,omitempty"`
	Content        string                          `bson:"content" json:"content"`
	MediaURL       string                          `bson:"mediaUrl,omitempty" json:"mediaUrl,omitempty"`
	Timestamp      time.Time                       `bson:"timestamp" json:"timestamp"`
	ReadBy         []primitive.ObjectID            `bson:"readBy" json:"readBy"`
	Reactions      map[string][]primitive.ObjectID `bson:"reactions,omitempty" json:"reactions,omitempty"`
	Pinned         bool                            `bson:"pinned" json:"pinned"`
	StarredBy      []primitive.ObjectID            `bson:"starredBy" json:"starredBy"`
	RepliedMessage *RepliedMessageInfo             `bson:"repliedMessage,omitempty" json:"repliedMessage,omitempty"`
}
