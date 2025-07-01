package models

import "go.mongodb.org/mongo-driver/bson/primitive"

// Room represents a chat room (group or private)
// ID is the MongoDB ObjectID
// Name is the room name
// Members is a list of user IDs
// IsGroup indicates if this is a group chat
type Room struct {
	ID          primitive.ObjectID   `bson:"_id,omitempty" json:"id"`
	Name        string               `bson:"name" json:"name"`
	Members     []primitive.ObjectID `bson:"members" json:"members"`
	IsGroup     bool                 `bson:"isGroup" json:"isGroup"`
	Avatar      string               `bson:"avatar,omitempty" json:"avatar,omitempty"`
	Description string               `bson:"description,omitempty" json:"description,omitempty"`
}
