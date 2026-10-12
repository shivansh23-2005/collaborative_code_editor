
package com.example.backend.repository;

import com.example.backend.entity.Room;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface RoomRepository extends JpaRepository<Room, String> {

    List<Room> findByCreatedByIgnoreCase(String createdBy);

    Optional<Room> findByIdAndCreatedByIgnoreCase(
            String id, String createdBy
    );
}
