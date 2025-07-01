package sockets

import (
	"line/utils"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

func HandleWebSocket(c *gin.Context) {
	token := c.Query("token")
	userID, err := utils.ParseJWT(token)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token"})
		return
	}
	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		return
	}
	client := &Client{
		Conn:   conn,
		UserID: userID,
		Send:   make(chan interface{}),
	}
	H.Clients[userID] = client
	go client.WritePump()
	client.ReadPump()
	// Remove client from hub on disconnect
	delete(H.Clients, userID)
	if client.RoomID != "" {
		H.mu.Lock()
		delete(H.Rooms[client.RoomID], userID)
		H.mu.Unlock()
	}
}
