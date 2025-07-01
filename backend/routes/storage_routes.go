package routes

import (
	"line/controllers"
	"line/middleware"

	"github.com/gin-gonic/gin"
)

// StorageRoutes sets up media upload routes
func StorageRoutes(r *gin.Engine) {
	media := r.Group("/rooms/:id/media")
	media.Use(middleware.JWTAuth())
	media.POST("", controllers.UploadMedia)
}
