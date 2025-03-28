console.log("Cosmic Collector game.js starting...");

document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('gameCanvas');
    if (!canvas) {
        console.error("Canvas element not found!");
        return;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        console.error("Failed to get 2D context!");
        return;
    }

    // --- Constants ---
    const PLAYER_WIDTH = 40;
    const PLAYER_HEIGHT = 20;
    const PLAYER_SPEED = 7;
    const ITEM_SIZE = 15;
    const STAR_COLOR = '#FFFF00'; // Yellow
    const ASTEROID_COLOR = '#A0522D'; // Brown/Sienna
    const PLAYER_COLOR = '#00FF00'; // Bright Green
    const STARFIELD_STARS = 200;
    const INITIAL_SPAWN_RATE = 0.015; // Probability of spawning an item per frame
    const MAX_SPAWN_RATE = 0.05;
    const SPAWN_RATE_INCREASE = 0.00001;
    const INITIAL_ITEM_SPEED = 2;
    const MAX_ITEM_SPEED = 8;
    const ITEM_SPEED_INCREASE = 0.0005;

    // --- Game State Variables ---
    let score = 0;
    let gameOver = false;
    let stars = []; // For background starfield
    let spawnRate = INITIAL_SPAWN_RATE;
    let itemSpeed = INITIAL_ITEM_SPEED;

    const player = {
        x: canvas.width / 2 - PLAYER_WIDTH / 2,
        y: canvas.height - PLAYER_HEIGHT - 10,
        width: PLAYER_WIDTH,
        height: PLAYER_HEIGHT,
        dx: 0 // Change in x per frame
    };

    let items = []; // Array to hold falling stars and asteroids

    // Input handling
    const keys = {
        ArrowLeft: false,
        ArrowRight: false
    };

    // --- Utility Functions ---

    // Simple Axis-Aligned Bounding Box collision detection
    function checkCollision(rect1, rect2) {
        return rect1.x < rect2.x + rect2.width &&
               rect1.x + rect1.width > rect2.x &&
               rect1.y < rect2.y + rect2.height &&
               rect1.y + rect1.height > rect2.y;
    }

    // Create the background starfield once
    function createStarfield() {
        stars = []; // Clear existing stars
        for (let i = 0; i < STARFIELD_STARS; i++) {
            stars.push({
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height,
                radius: Math.random() * 1.5 + 0.5 // Small radius
            });
        }
        console.log("Starfield created with", stars.length, "stars.");
    }

    // --- Game Logic Functions ---

    function spawnItem() {
        // Randomly decide whether to spawn an item based on spawnRate
        if (Math.random() < spawnRate) {
            const x = Math.random() * (canvas.width - ITEM_SIZE);
            const y = -ITEM_SIZE; // Start just above the screen
            const type = Math.random() < 0.7 ? 'star' : 'asteroid'; // 70% chance of star

            items.push({
                x: x,
                y: y,
                size: ITEM_SIZE,
                speed: itemSpeed + (Math.random() * 1 - 0.5), // Add slight speed variation
                type: type
            });
        }
    }

    function updatePlayer() {
        player.dx = 0; // Reset movement intention
        if (keys.ArrowLeft) {
            player.dx = -PLAYER_SPEED;
        }
        if (keys.ArrowRight) {
            player.dx = PLAYER_SPEED;
        }

        // Apply movement
        player.x += player.dx;

        // Keep player within canvas bounds
        if (player.x < 0) {
            player.x = 0;
        }
        if (player.x + player.width > canvas.width) {
            player.x = canvas.width - player.width;
        }
    }

    function updateItems() {
        for (let i = items.length - 1; i >= 0; i--) {
            const item = items[i];
            item.y += item.speed;

            // Check collision with player
            const playerRect = { x: player.x, y: player.y, width: player.width, height: player.height };
            const itemRect = { x: item.x, y: item.y, width: item.size, height: item.size };

            if (checkCollision(playerRect, itemRect)) {
                if (item.type === 'star') {
                    score++;
                    // Optional: Play a sound effect
                    items.splice(i, 1); // Remove collected star
                    // console.log("Score:", score);
                } else { // Hit an asteroid
                    gameOver = true;
                    // Optional: Play game over sound
                    console.log("Game Over! Final Score:", score);
                    items.splice(i, 1); // Remove asteroid that hit
                    // No need to continue updating items after game over
                    return;
                }
            }
            // Remove items that fall off the bottom
            else if (item.y > canvas.height) {
                items.splice(i, 1);
            }
        }
    }

    function updateDifficulty() {
        // Increase spawn rate and item speed over time, up to max values
        spawnRate = Math.min(MAX_SPAWN_RATE, spawnRate + SPAWN_RATE_INCREASE);
        itemSpeed = Math.min(MAX_ITEM_SPEED, itemSpeed + ITEM_SPEED_INCREASE);
    }

    // --- Drawing Functions ---

    function drawStarfield() {
        ctx.fillStyle = '#FFFFFF'; // White stars
        stars.forEach(star => {
            ctx.beginPath();
            ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
            ctx.fill();
        });
    }

    function drawPlayer() {
        ctx.fillStyle = PLAYER_COLOR;
        // Simple triangle shape for player ship
        ctx.beginPath();
        ctx.moveTo(player.x + player.width / 2, player.y); // Top point
        ctx.lineTo(player.x, player.y + player.height); // Bottom left
        ctx.lineTo(player.x + player.width, player.y + player.height); // Bottom right
        ctx.closePath();
        ctx.fill();
    }

    function drawItems() {
        items.forEach(item => {
            if (item.type === 'star') {
                // Draw a simple star (e.g., a filled circle)
                ctx.fillStyle = STAR_COLOR;
                ctx.beginPath();
                ctx.arc(item.x + item.size / 2, item.y + item.size / 2, item.size / 2, 0, Math.PI * 2);
                ctx.fill();
            } else { // Asteroid
                // Draw a simple asteroid (e.g., a filled square/rect)
                ctx.fillStyle = ASTEROID_COLOR;
                ctx.fillRect(item.x, item.y, item.size, item.size);
                 // Optional: Add crater-like details or jagged edges if desired
                 ctx.fillStyle = '#693d1a'; // Darker brown
                 ctx.fillRect(item.x + item.size * 0.2, item.y + item.size * 0.2, item.size * 0.3, item.size * 0.3);
                 ctx.fillRect(item.x + item.size * 0.6, item.y + item.size * 0.5, item.size * 0.2, item.size * 0.2);
            }
        });
    }

    function drawUI() {
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '24px Arial';
        ctx.textAlign = 'left';
        ctx.fillText(`Score: ${score}`, 10, 30);

        // Display difficulty indicators (optional)
        // ctx.font = '14px Arial';
        // ctx.fillText(`Speed: ${itemSpeed.toFixed(2)}`, 10, 50);
        // ctx.fillText(`Spawn: ${(spawnRate * 100).toFixed(2)}%`, 10, 70);

        if (gameOver) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'; // Semi-transparent overlay
            ctx.fillRect(0, canvas.height / 2 - 60, canvas.width, 120);

            ctx.fillStyle = '#FF0000'; // Red text
            ctx.font = '48px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('GAME OVER', canvas.width / 2, canvas.height / 2);
            ctx.fillStyle = '#FFFFFF'; // White text
            ctx.font = '24px Arial';
            ctx.fillText(`Final Score: ${score}`, canvas.width / 2, canvas.height / 2 + 40);
             ctx.font = '18px Arial';
             ctx.fillText('Press ENTER to Restart', canvas.width / 2, canvas.height / 2 + 70);
        }
    }

    // --- Game Loop ---
    function gameLoop() {
        // Clear the canvas
        ctx.fillStyle = '#000000'; // Ensure background is black before drawing stars
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw background
        drawStarfield();

        // If game over, only draw UI and wait for restart
        if (gameOver) {
            drawPlayer(); // Still draw player in final position
            drawItems(); // Draw remaining items frozen
            drawUI(); // Draw game over message
            // No updates happen, loop essentially pauses here visually
            requestAnimationFrame(gameLoop); // Keep drawing the game over screen
            return;
        }

        // --- Update game state ---
        updatePlayer();
        spawnItem(); // Try to spawn new items
        updateItems(); // Move items and check collisions
        updateDifficulty(); // Increase difficulty

        // --- Draw everything ---
        drawPlayer();
        drawItems();
        drawUI(); // Draw score

        // Request the next frame
        requestAnimationFrame(gameLoop);
    }

    // --- Initialization ---
    function initGame() {
        console.log("Initializing game...");
        score = 0;
        gameOver = false;
        player.x = canvas.width / 2 - PLAYER_WIDTH / 2;
        player.y = canvas.height - PLAYER_HEIGHT - 10;
        player.dx = 0;
        items = []; // Clear existing items
        spawnRate = INITIAL_SPAWN_RATE;
        itemSpeed = INITIAL_ITEM_SPEED;

        // Ensure starfield is created if it hasn't been
        if (stars.length === 0) {
            createStarfield();
        }

        // Add input listeners
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);

        console.log("Starting game loop...");
        // Start the game loop
        requestAnimationFrame(gameLoop);
    }

     // Separate functions for keydown and keyup
     function handleKeyDown(e) {
         if (e.code === 'ArrowLeft') keys.ArrowLeft = true;
         if (e.code === 'ArrowRight') keys.ArrowRight = true;
         if (gameOver && e.code === 'Enter') {
             console.log("Restarting game...");
              // Remove listeners briefly to prevent sticky keys on restart? Maybe not needed.
             initGame(); // Re-initialize and start the loop again
         }
     }

     function handleKeyUp(e) {
         if (e.code === 'ArrowLeft') keys.ArrowLeft = false;
         if (e.code === 'ArrowRight') keys.ArrowRight = false;
     }

    // --- Start the game ---
    initGame();

}); // End DOMContentLoaded
