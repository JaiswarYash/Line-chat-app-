package controllers

import (
	"context"
	"fmt"
	"line/config"
	"line/models"
	"line/utils"
	"net/http"
	"path/filepath"
	"strings"
	"time"
	"unicode"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"golang.org/x/crypto/bcrypt"
)

func validatePassword(password string) bool {
	var (
		hasMinLen  = false
		hasUpper   = false
		hasLower   = false
		hasNumber  = false
		hasSpecial = false
	)
	if len(password) >= 8 {
		hasMinLen = true
	}
	for _, char := range password {
		switch {
		case unicode.IsUpper(char):
			hasUpper = true
		case unicode.IsLower(char):
			hasLower = true
		case unicode.IsNumber(char):
			hasNumber = true
		case unicode.IsPunct(char) || unicode.IsSymbol(char):
			hasSpecial = true
		}
	}
	return hasMinLen && (hasUpper || hasLower) && hasNumber && hasSpecial
}

func Signup(c *gin.Context) {
	var req struct {
		Username string `json:"username"`
		Email    string `json:"email"`
		Password string `json:"password"`
		Avatar   string `json:"avatar"`
		About    string `json:"about"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input"})
		return
	}

	if !validatePassword(req.Password) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Password is not strong enough. It must be at least 8 characters long and contain at least one letter, one number, and one special character."})
		return
	}

	// Hash password and check for errors
	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), 12)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to hash password"})
		return
	}
	user := models.User{Username: req.Username, Email: req.Email, Password: string(hash), Avatar: req.Avatar, About: req.About}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_, err = config.DB.Collection("users").InsertOne(ctx, user)
	if err != nil {
		if strings.Contains(err.Error(), "duplicate key error") {
			if strings.Contains(err.Error(), "username") {
				c.JSON(http.StatusConflict, gin.H{"error": "Username already exists"})
				return
			} else if strings.Contains(err.Error(), "email") {
				c.JSON(http.StatusConflict, gin.H{"error": "Email already exists"})
				return
			}
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create user"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Signup successful"})
}

func Login(c *gin.Context) {
	var req struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input"})
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	var user models.User
	err := config.DB.Collection("users").FindOne(ctx, bson.M{"username": req.Username}).Decode(&user)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid credentials"})
		return
	}
	if bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.Password)) != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid credentials"})
		return
	}
	token, err := utils.GenerateJWT(user.ID.Hex())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate token"})
		return
	}
	// Remove password before sending response
	user.Password = ""
	c.JSON(http.StatusOK, gin.H{"token": token, "user": user})
}

// GetAllUsers returns all users except the requester
func GetAllUsers(c *gin.Context) {
	userID := c.Query("exclude")
	filter := bson.M{}
	if userID != "" {
		// Convert to ObjectID
		objID, err := primitive.ObjectIDFromHex(userID)
		if err == nil {
			filter = bson.M{"_id": bson.M{"$ne": objID}}
		}
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	cursor, err := config.DB.Collection("users").Find(ctx, filter)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "DB error"})
		return
	}
	var users []models.User
	if err := cursor.All(ctx, &users); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "DB error"})
		return
	}
	for i := range users {
		users[i].Password = "" // Remove password
	}
	c.JSON(http.StatusOK, users)
}

// UpdateUserProfile allows a user to update their avatar, about, and username
func UpdateUserProfile(c *gin.Context) {
	userID := c.Param("id")
	var req struct {
		Username string `json:"username"`
		Avatar   string `json:"avatar"`
		About    string `json:"about"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input"})
		return
	}

	// Convert userID to ObjectID
	uid, err := primitive.ObjectIDFromHex(userID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Always include all fields in the update, even if they're empty
	update := bson.M{
		"username": req.Username,
		"about":    req.About,
	}

	// Only update avatar if it's provided
	if req.Avatar != "" {
		if !strings.HasPrefix(req.Avatar, "/uploads/") {
			update["avatar"] = "/uploads/" + filepath.Base(req.Avatar)
		} else {
			update["avatar"] = req.Avatar
		}
	}

	result, err := config.DB.Collection("users").UpdateByID(ctx, uid, bson.M{"$set": update})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update profile"})
		return
	}

	if result.ModifiedCount == 0 {
		// Even if no fields were modified, we should still return the current user
		var currentUser models.User
		err = config.DB.Collection("users").FindOne(ctx, bson.M{"_id": uid}).Decode(&currentUser)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
			return
		}
		currentUser.Password = ""
		c.JSON(http.StatusOK, gin.H{
			"message": "No changes needed",
			"user":    currentUser,
		})
		return
	}

	// Get the updated user to return in response
	var updatedUser models.User
	err = config.DB.Collection("users").FindOne(ctx, bson.M{"_id": uid}).Decode(&updatedUser)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch updated user"})
		return
	}

	// Remove password from response
	updatedUser.Password = ""

	c.JSON(http.StatusOK, gin.H{
		"message": "Profile updated",
		"user":    updatedUser,
	})
}

// UploadUserAvatar handles avatar uploads for a user
func UploadUserAvatar(c *gin.Context) {
	userID := c.Param("id")
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
	finalName := fmt.Sprintf("%d_%s%s", filename, userID, ext)
	savePath := filepath.Join("storage", "uploads", finalName)

	// Save file
	if err := c.SaveUploadedFile(file, savePath); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save file"})
		return
	}

	// Update user's avatar in database
	uid, err := primitive.ObjectIDFromHex(userID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	avatarURL := "/uploads/" + finalName
	result, err := config.DB.Collection("users").UpdateByID(ctx, uid, bson.M{"$set": bson.M{"avatar": avatarURL}})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update avatar in database"})
		return
	}

	if result.ModifiedCount == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	// Get updated user
	var updatedUser models.User
	err = config.DB.Collection("users").FindOne(ctx, bson.M{"_id": uid}).Decode(&updatedUser)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch updated user"})
		return
	}

	// Remove password from response
	updatedUser.Password = ""

	c.JSON(http.StatusOK, gin.H{
		"url":  avatarURL,
		"user": updatedUser,
	})
}
