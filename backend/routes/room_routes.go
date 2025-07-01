package routes

import (
	"line/controllers"
	"line/middleware"

	"github.com/gin-gonic/gin"
)

// RoomRoutes sets up room-related routes
func RoomRoutes(r *gin.Engine) {
	r.Group("/rooms").Use(middleware.JWTAuth()).POST("", controllers.CreateRoom)
	r.Group("/rooms").Use(middleware.JWTAuth()).POST("/avatar", controllers.UploadRoomAvatar)
	rooms := r.Group("/users/:id/rooms")
	rooms.Use(middleware.JWTAuth())
	rooms.GET("", controllers.GetUserRooms)
}
