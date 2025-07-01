package routes

import (
	"line/controllers"
	"line/middleware"

	"github.com/gin-gonic/gin"
)

func ContactRoutes(r *gin.Engine) {
	contacts := r.Group("/contacts")
	contacts.Use(middleware.JWTAuth())
	{
		contacts.GET("/", controllers.GetContacts)
		contacts.POST("/add", controllers.AddContactByEmail)
		contacts.POST("/add/", controllers.AddContactByEmail)
	}
}
