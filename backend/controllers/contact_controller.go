package controllers

import (
	"context"
	"net/http"
	"strings"

	"line/config"
	"line/models"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
)

func GetContacts(c *gin.Context) {
	userI, exists := c.Get("user")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	currentUser := userI.(models.User)

	if len(currentUser.Contacts) == 0 {
		c.JSON(http.StatusOK, []models.User{})
		return
	}

	userCol := config.DB.Collection("users")
	ctx := context.Background()

	// Find all users whose ID is in the current user's contacts list
	cursor, err := userCol.Find(ctx, bson.M{"_id": bson.M{"$in": currentUser.Contacts}})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch contacts"})
		return
	}
	defer cursor.Close(ctx)

	var contacts []models.User
	if err = cursor.All(ctx, &contacts); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to decode contacts"})
		return
	}

	// Sanitize password from contacts
	for i := range contacts {
		contacts[i].Password = ""
	}

	c.JSON(http.StatusOK, contacts)
}

// AddContactByEmail adds a contact to the current user's contact list by email
func AddContactByEmail(c *gin.Context) {
	userI, exists := c.Get("user")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	currentUser := userI.(models.User)

	var req struct {
		Email string `json:"email"`
	}
	if err := c.ShouldBindJSON(&req); err != nil || strings.TrimSpace(req.Email) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid email"})
		return
	}

	userCol := config.DB.Collection("users")
	ctx := context.Background()

	// Find the user by email
	var contact models.User
	err := userCol.FindOne(ctx, bson.M{"email": req.Email}).Decode(&contact)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	if contact.ID == currentUser.ID {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot add yourself as a contact"})
		return
	}

	// Add contact's ObjectID to current user's Contacts array if not already present
	_, err = userCol.UpdateOne(ctx, bson.M{"_id": currentUser.ID}, bson.M{
		"$addToSet": bson.M{"contacts": contact.ID},
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to add contact"})
		return
	}

	// Add current user's ObjectID to contact's Contacts array if not already present
	_, err = userCol.UpdateOne(ctx, bson.M{"_id": contact.ID}, bson.M{
		"$addToSet": bson.M{"contacts": currentUser.ID},
	})
	if err != nil {
		// This is not ideal, as the first user has the contact but the second doesn't.
		// In a real-world app, this should be a transaction.
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to complete contact addition"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Contact added successfully", "contactId": contact.ID})
}
