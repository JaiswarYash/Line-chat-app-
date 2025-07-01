package sockets

import (
	"sync"
)

// Hub manages all WebSocket clients and rooms
type Hub struct {
	Clients   map[string]*Client
	Rooms     map[string]map[string]*Client
	Broadcast chan MessageEvent
	Typing    chan TypingEvent
	Presence  chan PresenceEvent
	Reaction  chan ReactionEvent
	Pin       chan PinEvent
	Star      chan StarEvent
	Delete    chan DeleteEvent
	Forward   chan ForwardEvent
	mu        sync.Mutex
}

var H = &Hub{
	Clients:   make(map[string]*Client),
	Rooms:     make(map[string]map[string]*Client),
	Broadcast: make(chan MessageEvent),
	Typing:    make(chan TypingEvent),
	Presence:  make(chan PresenceEvent),
	Reaction:  make(chan ReactionEvent),
	Pin:       make(chan PinEvent),
	Star:      make(chan StarEvent),
	Delete:    make(chan DeleteEvent),
	Forward:   make(chan ForwardEvent),
}

// Run starts the main event loop for the hub
func (h *Hub) Run() {
	for {
		select {
		case msg := <-h.Broadcast:
			h.mu.Lock()
			for _, client := range h.Rooms[msg.RoomID] {
				client.Send <- msg
			}
			h.mu.Unlock()
		case typing := <-h.Typing:
			h.mu.Lock()
			for _, client := range h.Rooms[typing.RoomID] {
				if client.UserID != typing.UserID {
					client.Send <- typing
				}
			}
			h.mu.Unlock()
		case presence := <-h.Presence:
			h.mu.Lock()
			for _, client := range h.Rooms[presence.RoomID] {
				client.Send <- presence
			}
			h.mu.Unlock()
		case reaction := <-h.Reaction:
			h.mu.Lock()
			for _, client := range h.Rooms[reaction.RoomID] {
				client.Send <- reaction
			}
			h.mu.Unlock()
		case pin := <-h.Pin:
			h.mu.Lock()
			for _, client := range h.Rooms[pin.RoomID] {
				client.Send <- pin
			}
			h.mu.Unlock()
		case star := <-h.Star:
			h.mu.Lock()
			for _, client := range h.Rooms[star.RoomID] {
				client.Send <- star
			}
			h.mu.Unlock()
		case del := <-h.Delete:
			h.mu.Lock()
			for _, client := range h.Rooms[del.RoomID] {
				client.Send <- del
			}
			h.mu.Unlock()
		case fwd := <-h.Forward:
			h.mu.Lock()
			for _, client := range h.Rooms[fwd.RoomID] {
				client.Send <- fwd
			}
			h.mu.Unlock()
		}
	}
}
