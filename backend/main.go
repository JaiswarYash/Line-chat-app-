package main

import (
	"line/config"
	"line/routes"
	"line/sockets"
	"os"

	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

// main is the entry point for the backend server
func main() {
	config.LoadEnv()
	config.ConnectDB()

	go sockets.H.Run()

	r := gin.Default()

	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"*"},
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	r.GET("/uploads/*filepath", func(c *gin.Context) {
		c.File("./storage/uploads/" + c.Param("filepath"))
	})

	routes.AuthRoutes(r)
	routes.RoomRoutes(r)
	routes.MessageRoutes(r)
	routes.StorageRoutes(r)
	routes.WebSocketRoutes(r)
	routes.ContactRoutes(r)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	r.Run(":" + port)
}
