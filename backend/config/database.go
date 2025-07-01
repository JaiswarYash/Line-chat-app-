package config

import (
	"context"
	"log"
	"time"

	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

var DB *mongo.Database

// ConnectDB connects to MongoDB and sets the global DB variable
func ConnectDB() {
	uri := GetEnv("MONGO_URI", "mongodb://localhost:27017")
	client, err := mongo.NewClient(options.Client().ApplyURI(uri))
	if err != nil {
		log.Fatal("Mongo client error:", err)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	err = client.Connect(ctx)
	if err != nil {
		log.Fatal("Mongo connect error:", err)
	}
	DB = client.Database(GetEnv("MONGO_DB", "chatapp"))

	// Create unique index for user email
	userCollection := DB.Collection("users")
	indexModel := mongo.IndexModel{
		Keys:    map[string]interface{}{"email": 1},
		Options: options.Index().SetUnique(true),
	}
	_, err = userCollection.Indexes().CreateOne(context.Background(), indexModel)
	if err != nil {
		log.Println("Could not create index for email:", err)
	}
}
