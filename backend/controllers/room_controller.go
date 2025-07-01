package controllers

import (
	"context"
	"line/config"
	"line/models"
	"line/utils"
	"net/http"
	"strings"
	"time"

	"fmt"
	"path/filepath"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo/options"
)

func GetUserRooms(c *gin.Context) {
	userID := c.Param("id")
	uid, err := primitive.ObjectIDFromHex(userID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	cursor, err := config.DB.Collection("rooms").Find(ctx, bson.M{"members": uid})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "DB error"})
		return
	}
	var rooms []models.Room
	if err := cursor.All(ctx, &rooms); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "DB error"})
		return
	}

	// For each room, fetch last message and unread count
	var result []gin.H
	for _, room := range rooms {
		msgColl := config.DB.Collection("messages")
		// Last message
		var lastMsg models.Message
		err := msgColl.FindOne(ctx, bson.M{"roomId": room.ID}, &options.FindOneOptions{
			Sort: bson.M{"timestamp": -1},
		}).Decode(&lastMsg)
		lastMessage := gin.H{}
		if err == nil {
			lastMessage = gin.H{
				"content":   lastMsg.Content,
				"timestamp": lastMsg.Timestamp,
			}
		}
		// Unread count
		unreadCount, _ := msgColl.CountDocuments(ctx, bson.M{"roomId": room.ID, "readBy": bson.M{"$ne": uid}})
		result = append(result, gin.H{
			"id":          room.ID,
			"name":        room.Name,
			"members":     room.Members,
			"isGroup":     room.IsGroup,
			"avatar":      room.Avatar,
			"description": room.Description,
			"lastMessage": lastMessage,
			"unreadCount": unreadCount,
		})
	}
	c.JSON(http.StatusOK, result)
}

// CreateRoom allows a user to create a new chat room (private or group)
func CreateRoom(c *gin.Context) {
	var req struct {
		Name    string   `json:"name"`
		Members []string `json:"members"` // user IDs as strings
		IsGroup bool     `json:"isGroup"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input"})
		return
	}

	// Get creator user ID from JWT
	token := c.GetHeader("Authorization")
	if token != "" {
		token = strings.TrimPrefix(token, "Bearer ")
	}
	if token == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Missing token"})
		return
	}
	creatorID, err := utils.ParseJWT(token)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token"})
		return
	}
	creatorObjID, err := primitive.ObjectIDFromHex(creatorID)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid user ID in token"})
		return
	}

	// Build member list, ensuring creator is included
	memberMap := map[primitive.ObjectID]bool{creatorObjID: true}
	for _, id := range req.Members {
		objID, err := primitive.ObjectIDFromHex(id)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid member ID"})
			return
		}
		memberMap[objID] = true
	}
	var memberIDs []primitive.ObjectID
	for id := range memberMap {
		memberIDs = append(memberIDs, id)
	}

	room := models.Room{
		Name:    req.Name,
		Members: memberIDs,
		IsGroup: req.IsGroup,
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	res, err := config.DB.Collection("rooms").InsertOne(ctx, room)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "DB error"})
		return
	}
	room.ID = res.InsertedID.(primitive.ObjectID)
	c.JSON(http.StatusOK, room)
}

// UploadRoomAvatar handles avatar uploads for a group (room)
func UploadRoomAvatar(c *gin.Context) {
	file, err := c.FormFile("avatar")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No file"})
		return
	}

	// Validate file type
	ext := filepath.Ext(file.Filename)
	allowedExts := map[string]bool{".jpg": true, ".jpeg": true, ".png": true, ".gif": true, ".webp": true}
	if !allowedExts[strings.ToLower(ext)] {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid file type. Only images are allowed."})
		return
	}

	// Generate unique filename
	filename := time.Now().UnixNano()
	finalName := fmt.Sprintf("%d_group%s", filename, ext)
	savePath := filepath.Join("storage", "uploads", finalName)

	// Save file
	if err := c.SaveUploadedFile(file, savePath); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save file"})
		return
	}

	avatarURL := "/uploads/" + finalName
	c.JSON(http.StatusOK, gin.H{"url": avatarURL})
}

// GetStarredMessages returns all starred messages for the current user
func GetStarredMessages(c *gin.Context) {
	token := c.GetHeader("Authorization")
	if token != "" {
		token = strings.TrimPrefix(token, "Bearer ")
	}
	if token == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Missing token"})
		return
	}
	userID, err := utils.ParseJWT(token)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token"})
		return
	}
	userObjID, err := primitive.ObjectIDFromHex(userID)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid user ID in token"})
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	cursor, err := config.DB.Collection("messages").Find(ctx, bson.M{"starredBy": userObjID})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "DB error"})
		return
	}
	var messages []models.Message
	if err := cursor.All(ctx, &messages); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "DB error"})
		return
	}
	// Optionally, fetch sender names
	var result []gin.H
	for _, msg := range messages {
		var sender models.User
		_ = config.DB.Collection("users").FindOne(ctx, bson.M{"_id": msg.SenderID}).Decode(&sender)
		result = append(result, gin.H{
			"id":         msg.ID,
			"senderName": sender.Username,
			"content":    msg.Content,
			"timestamp":  msg.Timestamp,
		})
	}
	c.JSON(http.StatusOK, result)
}
