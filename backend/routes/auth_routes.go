package routes

import (
	"line/controllers"

	"github.com/gin-gonic/gin"
)

// AuthRoutes sets up authentication routes
func AuthRoutes(r *gin.Engine) {
	r.POST("/signup", controllers.Signup)
	r.POST("/login", controllers.Login)
	r.GET("/users", controllers.GetAllUsers)
	r.PATCH("/users/:id", controllers.UpdateUserProfile)
	r.POST("/users/:id/avatar", controllers.UploadUserAvatar)
}
