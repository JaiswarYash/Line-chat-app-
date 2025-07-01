package routes

import (
	"line/middleware"
	"line/sockets"

	"github.com/gin-gonic/gin"
)

// WebSocketRoutes sets up the WebSocket endpoint
func WebSocketRoutes(r *gin.Engine) {
	r.GET("/ws", middleware.JWTAuth(), sockets.HandleWebSocket)
}
