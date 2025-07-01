package routes

import (
	"line/controllers"
	"line/middleware"

	"github.com/gin-gonic/gin"
)

// MessageRoutes sets up message-related routes
func MessageRoutes(r *gin.Engine) {
	msg := r.Group("/rooms/:id/messages")
	msg.Use(middleware.JWTAuth())
	msg.GET("", controllers.GetRoomMessages)
	msg.POST("/mark-read", controllers.MarkRoomMessagesRead)

	// Message actions (by message ID, not room)
	m := r.Group("/messages")
	m.Use(middleware.JWTAuth())
	m.POST(":msgId/pin", controllers.PinMessage)
	m.POST(":msgId/unpin", controllers.UnpinMessage)
	m.POST(":msgId/star", controllers.StarMessage)
	m.POST(":msgId/unstar", controllers.UnstarMessage)
	m.DELETE(":msgId", controllers.DeleteMessage)
	m.POST(":msgId/forward", controllers.ForwardMessage)
	m.GET("/starred", controllers.GetStarredMessages)
}
