package middleware

import (
	"line/config"
	"line/models"
	"line/utils"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// JWTAuth is a middleware that checks for a valid JWT in the Authorization header
func JWTAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		token := ""
		authHeader := c.GetHeader("Authorization")
		if authHeader != "" {
			token = strings.TrimPrefix(authHeader, "Bearer ")
		} else if t := c.Query("token"); t != "" {
			token = t
		}
		if token == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Missing token"})
			return
		}
		userID, err := utils.ParseJWT(token)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Invalid token"})
			return
		}
		// Fetch user from DB and set in context
		userCol := config.DB.Collection("users")
		var userObj models.User
		objID, _ := primitive.ObjectIDFromHex(userID)
		err = userCol.FindOne(c, bson.M{"_id": objID}).Decode(&userObj)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "User not found"})
			return
		}
		c.Set("user", userObj)
		c.Next()
	}
}
