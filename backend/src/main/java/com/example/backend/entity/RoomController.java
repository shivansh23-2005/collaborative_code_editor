
package com.example.backend.controller;

import com.example.backend.entity.Room;
import com.example.backend.repository.RoomRepository;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/rooms")
@CrossOrigin(origins = {
        "http://localhost:5173",
        "http://localhost:3000"
})
public class RoomController {

    private final RoomRepository roomRepository;

    public RoomController(RoomRepository roomRepository) {
        this.roomRepository = roomRepository;
    }

    // Get rooms created by a particular account
    @GetMapping
    public ResponseEntity<List<Room>> getAllRooms(
            @RequestParam String createdBy) {

        if (createdBy == null || createdBy.isBlank()) {
            return ResponseEntity.badRequest().build();
        }

        List<Room> rooms =
                roomRepository.findByCreatedByIgnoreCase(
                        createdBy.trim()
                );

        return ResponseEntity.ok(rooms);
    }

    // Create a room
    @PostMapping
    public ResponseEntity<Room> createRoom(
            @RequestBody Map<String, String> request) {

        String name = request.get("name");
        String type = request.get("type");
        String createdBy = request.get("createdBy");

        if (name == null || name.isBlank()
                || type == null || type.isBlank()
                || createdBy == null || createdBy.isBlank()) {

            return ResponseEntity.badRequest().build();
        }

        Room room = new Room();

        String roomId = "ROOM" + UUID.randomUUID()
                .toString()
                .replace("-", "")
                .substring(0, 8)
                .toUpperCase();

        room.setId(roomId);
        room.setName(name.trim());
        room.setType(type.trim());
        room.setLanguage(
                request.getOrDefault("language", "Java")
        );
        room.setCreatedBy(createdBy.trim());
        room.setMembers(1);

        Room savedRoom = roomRepository.save(room);

        return ResponseEntity.ok(savedRoom);
    }

    // Get a room by ID so another account can join it
    @GetMapping("/{id}")
    public ResponseEntity<Room> getRoomById(
            @PathVariable String id) {

        return roomRepository.findById(id)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    // Delete a room only if its creator matches the supplied email
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteRoom(
            @PathVariable String id,
            @RequestParam String createdBy) {

        if (createdBy == null || createdBy.isBlank()) {
            return ResponseEntity.badRequest().build();
        }

        return roomRepository
                .findByIdAndCreatedByIgnoreCase(
                        id,
                        createdBy.trim()
                )
                .map(room -> {
                    roomRepository.delete(room);
                    return ResponseEntity.noContent().<Void>build();
                })
                .orElseGet(() ->
                        ResponseEntity.notFound().build()
                );
    }
}
