package models

import "go.mongodb.org/mongo-driver/bson/primitive"

type User struct {
	ID       primitive.ObjectID   `bson:"_id,omitempty" json:"id"`
	Username string               `bson:"username" json:"username"`
	Email    string               `bson:"email" json:"email"`
	Password string               `bson:"password,omitempty" json:"-"`
	Avatar   string               `bson:"avatar,omitempty" json:"avatar,omitempty"`
	About    string               `bson:"about,omitempty" json:"about,omitempty"`
	Contacts []primitive.ObjectID `bson:"contacts,omitempty" json:"contacts,omitempty"`
}
