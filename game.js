console.log("Game script started - Creative Overhaul");

document.addEventListener('DOMContentLoaded', function() {
    const canvas = document.getElementById('gameCanvas');
    if (!canvas) { console.error("Canvas element not found!"); return; }
    const ctx = canvas.getContext('2d');
    if (!ctx) { console.error("Failed to get 2D context!"); return; }

    // --- Constants ---
    const GROUND_HEIGHT = 100; // Apparent ground level from bottom (affects Y positioning)
    // Y offsets position the *bottom* of the sprite relative to the ground
    const PLAYER_Y_BOTTOM_OFFSET = 50; // How many pixels from bottom of canvas is Eric's feet?
    const ENEMY_Y_BOTTOM_OFFSET = 50;
    const CRAB_Y_BOTTOM_OFFSET = 180; // Crab seems higher, adjust as needed

    const ERIC_DRAW_HEIGHT = 400; // Visual height of Eric sprite
    const MICKEY_DRAW_HEIGHT = 400;
    const CRAB_DRAW_HEIGHT = 250; // Visual height of Crab sprite

    const MICKEY_MAX_HITS = 6;
    const CRAB_MAX_HITS = 2; // Hits needed for non-parry kill
    const PUNCH_ACTIVE_FRAMES = 15; // Punch active duration
    const CRUNCH_ACTIVE_FRAMES = 15; // Crunch active duration
    const PARRY_WINDOW = 5;        // Frames for successful crab parry (within crunch)
    const ACTION_DURATION_FRAMES = 28; // Total duration for punch/crunch animation cycle
    const PINCHED_DURATION_FRAMES = 45; // Stun duration when pinched
    const HIT_STAGGER_FRAMES = 25; // How long Mickey is in 'hit' state visual
    const DEATH_ANIMATION_FRAMES = 60;
    const BONUS_DISPLAY_FRAMES = 50;
    const INITIAL_CRAB_SPAWN_INTERVAL = 1000; // Frames between crab spawns initially
    const MIN_CRAB_SPAWN_INTERVAL = 300;     // Minimum frames between crab spawns
    const GAME_SPEED_INCREASE = 0.0004;      // How much speed increases per frame
    const MAX_GAME_SPEED = 5;                // Cap game speed
    const INSTRUCTION_DISPLAY_DURATION_MS = 10000; // On-canvas instructions duration
    const SCREEN_SHAKE_MAGNITUDE_HIT = 2;
    const SCREEN_SHAKE_DURATION_HIT = 5;
    const SCREEN_SHAKE_MAGNITUDE_KILL = 5;
    const SCREEN_SHAKE_DURATION_KILL = 10;
    const FLOATING_SCORE_DURATION = 45; // Frames for score text to float up
    const MIN_ENEMY_SPAWN_GAP = 200; // Min pixels between newly spawned enemy and existing one

    // --- Game State Variables ---
    let gameSpeed = 1;
    let score = 0;
    let frameCount = 0;
    let gameStartTime = null; // Will be set on game start
    let mickeyHitCount = 0;
    let scoreColor = '#FFFFFF'; // Use hex for consistency
    let showInstructions = true;
    let crabTimer = 0;
    let showBonus = false;
    let bonusTimer = 0;
    let gameRunning = false;
    let debugMode = false; // <<< SET TO true TO SEE HITBOXES >>>
    let screenShake = { duration: 0, magnitude: 0 };
    let floatingScores = []; // Array for displaying score popups

    // --- Utility Functions ---
    const getCrabSpawnInterval = () => Math.max(MIN_CRAB_SPAWN_INTERVAL, Math.floor(INITIAL_CRAB_SPAWN_INTERVAL / gameSpeed));

    // --- Asset Loading ---
    const assets = { images: {}, audio: {} };
    let punchEffectImages = []; // Will be populated after loading

    function loadImage(key, src) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            assets.images[key] = img; // Store image object immediately
            img.onload = () => {
                // console.log(`Image loaded: ${key}`);
                resolve(img);
            };
            img.onerror = (e) => {
                console.error(`Failed to load image: ${src}`, e);
                reject(`Failed to load image: ${src}`); // Reject promise on error
            };
            img.src = src;
        });
    }

    function loadAudio(key, src, loop = false) {
        return new Promise((resolve) => { // Always resolve, even on error
            const audio = new Audio(src);
            assets.audio[key] = audio; // Store audio object immediately
            audio.loop = loop;
            audio.addEventListener('canplaythrough', () => {
                // console.log(`Audio ready: ${key}`);
                resolve(audio)
            }, { once: true });
            audio.onerror = (e) => {
                console.error(`Failed to load audio: ${src}`, e);
                // Don't reject, game can potentially run without sound
                resolve(audio); // Resolve anyway, but sound won't play
            };
            audio.load(); // Important for preloading
        });
    }

    function loadGameAssets() {
        console.log("Starting asset loading...");
        const imagePromises = [
            loadImage('oceanBackground', 'assets/ImpossibleLoop01.png'),
            loadImage('cloudBackground', 'assets/ImpossibleClouds01.png'),
            loadImage('ericCrunch', 'assets/ericCrunch.png'),
            loadImage('ericPinched', 'assets/ericPinched.png'),
            loadImage('mickeyHit', 'assets/MickeyHit.png'),
            loadImage('crabCrunch', 'assets/crabCrunch.png'),
            loadImage('bonus', 'assets/Bonus.png'),
            loadImage('ericPunch1', 'assets/ericPunch.png'),
            loadImage('ericPunch2', 'assets/ericPunch2.png'),
        ];
        // Dynamically load sequences
        for (let i = 1; i <= 8; i++) imagePromises.push(loadImage(`ericRun${i}`, `assets/EricRun${i}.png`));
        for (let i = 1; i <= 21; i++) imagePromises.push(loadImage(`mickeyWalk${i}`, `assets/MickeyWalk${i.toString().padStart(2, '0')}.png`));
        for (let i = 1; i <= 3; i++) imagePromises.push(loadImage(`mickeyDie${i}`, `assets/MickeyDie${i}.png`));
        for (let i = 1; i <= 5; i++) imagePromises.push(loadImage(`crabWalk${i}`, `assets/crabWalk${i}.png`));
        for (let i = 1; i <= 3; i++) imagePromises.push(loadImage(`crabDead${i}`, `assets/crabDead${i}.png`));
        for (let i = 1; i <= 3; i++) imagePromises.push(loadImage(`punchEffect${i}`, `assets/PunchEffect${i}.png`));

        const audioPromises = [
            loadAudio('punch', 'assets/PunchSound.mp3'),
            loadAudio('fuckCrab', 'assets/fuckCrab.mp3'),
            loadAudio('ericOuch', 'assets/ericOuch.mp3'),
            loadAudio('mickeyDeath', 'assets/deathSound.mp3'),
            loadAudio('bonus', 'assets/bonusSound.mp3'),
            loadAudio('gameMusic', 'assets/GameMusic.mp3', true) // Loop music
        ];
        for (let i = 1; i <= 7; i++) audioPromises.push(loadAudio(`mickeyNoise${i}`, `assets/MickeyNoise${i}.mp3`));

        return Promise.all([...imagePromises, ...audioPromises]);
    }

    // Assign loaded assets to game objects (call AFTER loadGameAssets resolves)
     function assignAssets() {
        console.log("Assigning assets...");
        try {
            eric.walkImages = []; for (let i = 1; i <= 8; i++) eric.walkImages.push(assets.images[`ericRun${i}`]);
            eric.punchImages = [assets.images['ericPunch1'], assets.images['ericPunch2']];
            eric.crunchImage = assets.images['ericCrunch'];
            eric.pinchedImage = assets.images['ericPinched'];

            mickey.walkImages = []; for (let i = 1; i <= 21; i++) mickey.walkImages.push(assets.images[`mickeyWalk${i}`]);
            mickey.hitImage = assets.images['mickeyHit'];
            mickey.dieImages = []; for (let i = 1; i <= 3; i++) mickey.dieImages.push(assets.images[`mickeyDie${i}`]);

            crab.walkImages = []; for (let i = 1; i <= 5; i++) crab.walkImages.push(assets.images[`crabWalk${i}`]);
            crab.crunchImage = assets.images['crabCrunch'];
            crab.dieImages = []; for (let i = 1; i <= 3; i++) crab.dieImages.push(assets.images[`crabDead${i}`]);

            punchEffectImages = []; for (let i = 1; i <= 3; i++) punchEffectImages.push(assets.images[`punchEffect${i}`]);

            assets.audio.mickeyNoises = []; for (let i = 1; i <= 7; i++) assets.audio.mickeyNoises.push(assets.audio[`mickeyNoise${i}`]);
            assets.audio.currentMickeyNoiseIndex = 0;

            // Basic check if essential images loaded
             if (!eric.walkImages.length || !mickey.walkImages.length || !crab.walkImages.length || !punchEffectImages.length) {
                 throw new Error("Essential image sequences failed to assign.");
             }
              if (!eric.punchImages[0] || !eric.crunchImage || !eric.pinchedImage || !mickey.hitImage || !crab.crunchImage) {
                 throw new Error("Essential single frame images failed to assign.");
             }

            console.log("Assets assigned successfully.");
            return true; // Indicate success
        } catch (error) {
            console.error("Error during asset assignment:", error);
            // Display error on canvas if assignment fails
            ctx.fillStyle = 'red';
            ctx.font = 'bold 16px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('Error assigning assets. Check console.', canvas.width / 2, canvas.height / 2 + 40);
            ctx.textAlign = 'left'; // Reset
            return false; // Indicate failure
        }
    }
    // --- End Asset Loading ---


    // --- Background ---
    let oceanBackgroundX = 0;
    let cloudBackgroundX = 0;

    // --- Eric (Player) ---
    const eric = {
        // Eric's visual dimensions (might differ from hitbox)
        width: 900, // Full width of the PNG sprite sheet (adjust if needed)
        height: 500, // Full height of the PNG sprite sheet
        drawHeight: ERIC_DRAW_HEIGHT, // Actual visual height used for positioning
        // Position: x is left edge, y is top edge
        x: 100, // Start position (adjust as needed)
        y: canvas.height - PLAYER_Y_BOTTOM_OFFSET - ERIC_DRAW_HEIGHT,
        // Animation
        frameX: 0, // Current frame index for walking
        animationFrame: 0, // Counter for animation timing
        animationDelay: 12, // Frames per walk cycle frame
        // State & Actions
        state: 'walking', // walking, punching, crunching, pinched
        actionDuration: 0, // Counter for how long current action state lasts
        facingRight: true, // Direction tracking
        // Hitboxes (relative to eric.x when facingRight)
        // TUNING REQUIRED based on your actual PNG content!
        punchHitboxWidth: 120,
        punchHitboxHeight: 150, // Approximate height of punch
        punchHitboxOffsetY: 150, // Vertical offset from eric.y
        punchHitboxOffsetX: 680, // Horizontal offset from eric.x
        crunchHitboxWidth: 100,
        crunchHitboxHeight: 100, // Approximate height of crunch
        crunchHitboxOffsetY: ERIC_DRAW_HEIGHT * 0.75, // Lower part of Eric
        crunchHitboxOffsetX: 700,
        // Assigned images (populated by assignAssets)
        walkImages: [], punchImages: [], crunchImage: null, pinchedImage: null,
        currentPunchImage: null // Holds the randomly chosen punch image
    };

    // --- Mickey (Enemy 1) ---
    const mickey = {
        width: 900, height: 500, // Full PNG dimensions
        drawHeight: MICKEY_DRAW_HEIGHT,
        x: canvas.width, // Start off-screen right
        y: canvas.height - ENEMY_Y_BOTTOM_OFFSET - MICKEY_DRAW_HEIGHT,
        frameX: 0, animationFrame: 0, animationDelay: 4, // Animation
        baseSpeed: 2.2, speed: 2.2, // Movement speed
        visible: true, state: 'walking', // walking, hit, dying
        hitDuration: 0, // Counter for 'hit' state
        deathFrame: 0, deathAnimationDuration: 0, // For 'dying' state
        // Hitbox (relative to mickey.x) - TUNING REQUIRED!
        hitboxWidth: 100, // Width of the area that can be hit
        hitboxHeight: MICKEY_DRAW_HEIGHT * 0.8, // Height of hit area
        hitboxOffsetX: 400, // Horizontal offset from mickey.x
        hitboxOffsetY: MICKEY_DRAW_HEIGHT * 0.1, // Vertical offset from mickey.y
        // Assigned images
        walkImages: [], hitImage: null, dieImages: [],
        // Effects
        punchEffectIndex: -1, // Index for punch effect image
        punchEffectDuration: 0,
        aggressionLevel: 0 // Visual marker or behavior modifier
    };

    // --- Crab (Enemy 2) ---
    const crab = {
        width: 1000, height: 500, // Full PNG dimensions
        drawHeight: CRAB_DRAW_HEIGHT,
        x: canvas.width,
        y: canvas.height - CRAB_Y_BOTTOM_OFFSET - CRAB_DRAW_HEIGHT, // Positioned higher
        frameX: 0, animationFrame: 0, animationDelayBase: 9, // Animation
        baseSpeed: 3.5, speed: 3.5, // Movement
        visible: false, state: 'walking', // walking, crunched, dying
        hitCount: 0, // Hits needed for non-parry kill
        deathFrame: 0, deathAnimationDuration: 0, // Dying state
        crunchDuration: 0, // Crunched state visual
        // Hitbox (relative to crab.x) - TUNING REQUIRED!
        hitboxWidth: 200, // Wider hitbox for crab?
        hitboxHeight: CRAB_DRAW_HEIGHT * 0.8, // Most of the crab height
        hitboxOffsetX: 300, // Horizontal offset
        hitboxOffsetY: CRAB_DRAW_HEIGHT * 0.1, // Vertical offset
        // Assigned images
        walkImages: [], crunchImage: null, dieImages: []
    };


    // --- Sound Playback Helper ---
    function playSound(key, volume = 1.0) {
        const sound = assets.audio[key];
        // Check if sound exists and is likely loaded (readyState >= 3 means HAVE_FUTURE_DATA or HAVE_ENOUGH_DATA)
        if (sound && sound.readyState >= 3) {
            sound.currentTime = 0; // Rewind before playing
            sound.volume = Math.max(0, Math.min(1, volume)); // Clamp volume
            sound.play().catch(e => {
                 // Ignore errors often caused by rapid playback attempts
                 // console.warn(`Sound playback interrupted for ${key}: ${e.message}`);
            });
        } else if (sound && sound.readyState < 3) {
             // console.warn(`Attempted to play sound '${key}' before it was ready (readyState: ${sound.readyState}).`);
        } else {
            // console.warn(`Sound asset '${key}' not found or invalid.`);
        }
    }

    // --- Screen Shake ---
    function triggerScreenShake(duration, magnitude) {
        // Prioritize stronger/longer shakes
        screenShake.duration = Math.max(screenShake.duration, duration);
        screenShake.magnitude = Math.max(screenShake.magnitude, magnitude);
    }

    // --- Floating Score ---
     // Helper to convert color names/hex to RGB for rgba() - Improved
     function colorToRgbString(color) {
         color = color.toLowerCase();
         if (color === 'white') return '255, 255, 255';
         if (color === 'gold') return '255, 215, 0';
         if (color === 'lightgreen') return '144, 238, 144';
         if (color === 'red') return '255, 0, 0';
         if (color === 'cyan') return '0, 255, 255';
         if (color === '#aaa' || color === 'grey' || color === 'gray') return '170, 170, 170';

         if (color.startsWith('#')) {
             color = color.slice(1);
             if (color.length === 3) {
                 color = color[0] + color[0] + color[1] + color[1] + color[2] + color[2];
             }
             if (color.length === 6) {
                 const bigint = parseInt(color, 16);
                 const r = (bigint >> 16) & 255;
                 const g = (bigint >> 8) & 255;
                 const b = bigint & 255;
                 return `${r}, ${g}, ${b}`;
             }
         }
         console.warn(`Unsupported color format for floating score: ${color}. Defaulting to white.`);
         return '255, 255, 255'; // Default to white if unknown
     }

    function addFloatingScore(text, x, y, color = '#FFFFFF') {
        floatingScores.push({
            text: text,
            x: x,
            y: y,
            duration: FLOATING_SCORE_DURATION,
            alpha: 1.0,
            colorString: colorToRgbString(color) // Pre-convert color
        });
    }

    function updateFloatingScores() {
        for (let i = floatingScores.length - 1; i >= 0; i--) {
            const fs = floatingScores[i];
            fs.duration--;
            fs.y -= 0.8; // Float upwards faster
            fs.alpha = Math.max(0, fs.duration / FLOATING_SCORE_DURATION); // Fade out
            if (fs.duration <= 0) {
                floatingScores.splice(i, 1); // Remove when done
            }
        }
    }

    function drawFloatingScores() {
        ctx.font = 'bold 22px Arial'; // Slightly larger
        ctx.textAlign = 'center';
        floatingScores.forEach(fs => {
            ctx.fillStyle = `rgba(${fs.colorString}, ${fs.alpha})`;
            ctx.fillText(fs.text, fs.x, fs.y);
        });
        ctx.textAlign = 'left'; // Reset alignment
    }


    // --- Game Loop ---
    let lastFrameTime = 0;
    function gameLoop(timestamp) {
        if (!gameRunning) return;

        const deltaTime = timestamp - lastFrameTime; // Time since last frame
        lastFrameTime = timestamp;
        // Note: Currently game logic uses frame counts, not deltaTime.
        // If performance varies, consider switching to deltaTime for movement.

        // --- Pre-drawing state reset (like transform) ---
        ctx.save(); // Save default state (identity matrix)

        // Apply screen shake
        if (screenShake.duration > 0) {
            const shakeX = (Math.random() - 0.5) * 2 * screenShake.magnitude;
            const shakeY = (Math.random() - 0.5) * 2 * screenShake.magnitude;
            ctx.translate(shakeX, shakeY);
            screenShake.duration--;
            if (screenShake.duration <= 0) screenShake.magnitude = 0; // Reset magnitude when done
        }

        // --- Clearing ---
        // Clear the visible canvas area. If shake is applied, this clears correctly.
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // --- Updates ---
        updateBackground();
        updateEric();
        updateMickey();
        updateCrab();
        updateFloatingScores();
        updateGameSpeedAndScore();

        // --- Drawing ---
        drawBackground();
        drawCrab();     // Draw crab behind Mickey/Eric?
        drawMickey();
        drawEric();     // Draw Eric last (potentially flipped)
        drawScore();
        drawFloatingScores();
        drawInstructions(); // On-canvas instructions
        if (showBonus) drawBonus();

        // --- Post-drawing state restore ---
        ctx.restore(); // Restore to state before shake/transforms

        frameCount++; // Increment frame counter
        requestAnimationFrame(gameLoop); // Request next frame
    }

    // --- Update Functions ---
    function updateGameSpeedAndScore() {
        // Increase game speed gradually, up to a maximum
        if (gameRunning) {
            gameSpeed = Math.min(MAX_GAME_SPEED, gameSpeed + GAME_SPEED_INCREASE);
        }
        // Hide on-canvas instructions after a delay
        if (showInstructions && gameStartTime && (Date.now() - gameStartTime > INSTRUCTION_DISPLAY_DURATION_MS)) {
            showInstructions = false;
        }
         // Update Bonus display timer
         if (showBonus) {
             bonusTimer--;
             if (bonusTimer <= 0) {
                 showBonus = false;
             }
         }
    }

    function updateBackground() {
        // Scroll background layers at different speeds
        oceanBackgroundX -= gameSpeed * 1.0;
        if (oceanBackgroundX <= -canvas.width) {
             oceanBackgroundX += canvas.width; // Loop background
        }
        cloudBackgroundX -= gameSpeed * 0.5; // Clouds move slower
        if (cloudBackgroundX <= -canvas.width) {
             cloudBackgroundX += canvas.width;
        }
    }

    function updateEric() {
        // State Transitions based on duration
        if (eric.state !== 'walking') {
            eric.actionDuration++;
            const durationLimit = (eric.state === 'pinched') ? PINCHED_DURATION_FRAMES : ACTION_DURATION_FRAMES;
            if (eric.actionDuration > durationLimit) {
                eric.state = 'walking';
                eric.actionDuration = 0; // Reset duration when returning to walk
            }
        }

        // Animation - Only animate walking when in 'walking' state
        if (eric.state === 'walking') {
            eric.animationFrame++;
            if (eric.animationFrame >= eric.animationDelay) {
                eric.frameX = (eric.frameX + 1) % eric.walkImages.length;
                eric.animationFrame = 0;
            }
        } else {
            // Reset walk animation frame if not walking? Optional.
            // eric.frameX = 0;
            // eric.animationFrame = 0;
        }
        // Eric remains stationary horizontally in this game version
    }

    function updateMickey() {
        if (!mickey.visible) return; // Skip if not visible

        mickey.speed = mickey.baseSpeed * gameSpeed; // Scale speed

        switch (mickey.state) {
            case 'walking':
                mickey.x -= mickey.speed; // Move left
                // Animate walking
                mickey.animationFrame++;
                if (mickey.animationFrame >= mickey.animationDelay) {
                    mickey.frameX = (mickey.frameX + 1) % mickey.walkImages.length;
                    mickey.animationFrame = 0;
                }
                // Check if Mickey moved off-screen left (missed)
                if (mickey.x + mickey.width < 0) { // Check using full width
                    console.log("Mickey passed.");
                    // No penalty for Mickey passing in this version? Add if needed.
                    respawnMickey();
                }
                break;

            case 'hit':
                mickey.hitDuration++;
                // Stagger back slightly while hit
                if (mickey.hitDuration <= HIT_STAGGER_FRAMES) {
                    mickey.x += mickey.speed * 0.5; // Move slightly right
                }
                // Transition back to walking after hit duration
                if (mickey.hitDuration > ACTION_DURATION_FRAMES) { // Match action duration
                    mickey.state = 'walking';
                    mickey.hitDuration = 0;
                }
                break;

            case 'dying':
                mickey.deathAnimationDuration++;
                // Cycle through death frames
                const deathFrameDelay = Math.max(1, Math.floor(DEATH_ANIMATION_FRAMES / mickey.dieImages.length));
                mickey.deathFrame = Math.min(mickey.dieImages.length - 1, Math.floor(mickey.deathAnimationDuration / deathFrameDelay));
                // Respawn after death animation finishes
                if (mickey.deathAnimationDuration > DEATH_ANIMATION_FRAMES) {
                    respawnMickey();
                }
                break;
        }

        // Update punch effect display duration
        if (mickey.punchEffectIndex !== -1) {
            mickey.punchEffectDuration++;
            // Shorter duration for punch effect visual
            if (mickey.punchEffectDuration > PUNCH_ACTIVE_FRAMES / 2) {
                mickey.punchEffectIndex = -1;
                mickey.punchEffectDuration = 0;
            }
        }

        // Collision check needs to happen regardless of state if punch is active
        checkEricPunchCollision();
    }

    function updateCrab() {
        if (crab.visible) {
            crab.speed = crab.baseSpeed * gameSpeed; // Scale speed
            const currentAnimationDelay = Math.max(1, Math.floor(crab.animationDelayBase / gameSpeed)); // Faster animation at high speed

            switch (crab.state) {
                case 'walking':
                    crab.x -= crab.speed; // Move left
                    // Animate walking
                    crab.animationFrame++;
                    if (crab.animationFrame >= currentAnimationDelay) {
                        crab.frameX = (crab.frameX + 1) % crab.walkImages.length;
                        crab.animationFrame = 0;
                    }

                    // --- Crab Pinch Check ---
                    // Define Eric's front "danger zone" based on facing direction
                    let ericPinchZoneX;
                    let ericPinchZoneWidth = 50; // How close crab needs to be to pinch
                    if (eric.facingRight) {
                        // Zone is slightly in front of Eric's crunch hitbox start
                        ericPinchZoneX = eric.x + eric.crunchHitboxOffsetX - ericPinchZoneWidth / 2;
                    } else {
                         // Zone is slightly in front of Eric's *mirrored* crunch hitbox start
                         let mirroredCrunchStartX = eric.x + eric.width - eric.crunchHitboxOffsetX - eric.crunchHitboxWidth;
                         ericPinchZoneX = mirroredCrunchStartX - ericPinchZoneWidth / 2;
                    }

                    // Define crab's front edge (using hitbox offset)
                    const crabFrontEdge = crab.x + crab.hitboxOffsetX;

                    // Check if crab's front edge overlaps Eric's pinch zone
                    if (crabFrontEdge < ericPinchZoneX + ericPinchZoneWidth &&
                        crabFrontEdge > ericPinchZoneX) {
                         // Pinch only if Eric is walking (not already punching, crunching, or pinched)
                         if (eric.state === 'walking') {
                             crabPassed(); // Pinch Eric!
                         }
                    }
                    // Check if crab moved fully off-screen left
                    else if (crab.x + crab.width < 0) {
                        crab.visible = false; // Disappears without penalty if missed crunch
                        crabTimer = 0; // Reset spawn timer
                    }
                    break; // End case 'walking'

                case 'crunched': // State after a non-parry crunch hit
                    crab.crunchDuration++;
                    // Shorter visual stun for non-parry hit
                    if (crab.crunchDuration > ACTION_DURATION_FRAMES / 1.5) {
                        crab.state = 'walking';
                        crab.crunchDuration = 0;
                    }
                    // Crab might slide slightly during crunch? Optional.
                    // crab.x += gameSpeed * 0.2;
                    break;

                case 'dying':
                    crab.deathAnimationDuration++;
                    // Cycle through death frames
                    const deathFrameDelay = Math.max(1, Math.floor(DEATH_ANIMATION_FRAMES / crab.dieImages.length));
                    crab.deathFrame = Math.min(crab.dieImages.length - 1, Math.floor(crab.deathAnimationDuration / deathFrameDelay));
                    // Make invisible and reset after animation
                    if (crab.deathAnimationDuration > DEATH_ANIMATION_FRAMES) {
                        crab.visible = false;
                        crab.hitCount = 0; // Reset hit count for next spawn
                        crabTimer = 0; // Reset spawn timer
                    }
                    break;
            }
            // Check for Eric's crunch collision regardless of crab state (for parry timing)
            checkEricCrunchCollision();

        } else { // Crab is not visible
            crabTimer++;
            // Check if it's time to spawn
            if (crabTimer >= getCrabSpawnInterval()) {
                respawnCrab();
            }
        }
    }

    // Called when crab reaches Eric without being crunched/parried
    function crabPassed() {
        if (eric.state === 'pinched') return; // Can't be pinched twice

        console.log("Eric pinched!");
        crab.visible = false; // Crab disappears immediately
        eric.state = 'pinched';
        eric.actionDuration = 0; // Start pinched timer
        score = Math.max(0, score - 10); // Penalty, minimum score 0
        playSound('ericOuch', 1.0);
        triggerScreenShake(SCREEN_SHAKE_DURATION_HIT * 2, SCREEN_SHAKE_MAGNITUDE_HIT * 1.5); // Bigger shake for pinch
        // Floating score text for penalty
        addFloatingScore("-10", eric.x + eric.width / 2, eric.y + 50, 'red');
        crabTimer = 0; // Reset crab spawn timer
    }

    // --- Collision Detection ---

    // Check if Eric's punch hits Mickey
    function checkEricPunchCollision() {
        // Check only if Mickey is walking, Eric is punching, and punch is in active frames
        if (mickey.visible && mickey.state === 'walking' &&
            eric.state === 'punching' &&
            eric.actionDuration > 1 && eric.actionDuration <= PUNCH_ACTIVE_FRAMES + 1) // Active frames window
        {
            // Define Eric's punch hitbox based on direction
            let punchHitboxRect;
            if (eric.facingRight) {
                punchHitboxRect = {
                    x: eric.x + eric.punchHitboxOffsetX,
                    y: eric.y + eric.punchHitboxOffsetY,
                    width: eric.punchHitboxWidth,
                    height: eric.punchHitboxHeight
                };
            } else { // Facing left - mirrored hitbox
                 punchHitboxRect = {
                    x: eric.x + eric.width - eric.punchHitboxOffsetX - eric.punchHitboxWidth, // Flipped X
                    y: eric.y + eric.punchHitboxOffsetY,
                    width: eric.punchHitboxWidth,
                    height: eric.punchHitboxHeight
                 };
            }

            // Define Mickey's hittable area
            const mickeyHitboxRect = {
                x: mickey.x + mickey.hitboxOffsetX,
                y: mickey.y + mickey.hitboxOffsetY,
                width: mickey.hitboxWidth,
                height: mickey.hitboxHeight
            };

            // Simple AABB (Axis-Aligned Bounding Box) collision check
            if (punchHitboxRect.x < mickeyHitboxRect.x + mickeyHitboxRect.width &&
                punchHitboxRect.x + punchHitboxRect.width > mickeyHitboxRect.x &&
                punchHitboxRect.y < mickeyHitboxRect.y + mickeyHitboxRect.height &&
                punchHitboxRect.y + punchHitboxRect.height > mickeyHitboxRect.y)
            {
                console.log("Punch HIT Mickey!");
                 // Calculate center of punch for effects/score text
                 const hitX = punchHitboxRect.x + punchHitboxRect.width / 2;
                 const hitY = punchHitboxRect.y + punchHitboxRect.height / 2;
                 hitMickey(hitX, hitY); // Call hit handler

                 // Apply pushback - Simplified
                 const pushbackDistance = 30; // Pixels to push Mickey back
                 mickey.x += pushbackDistance; // Push Mickey slightly right always on hit

            }
        }
    }

    // Check if Eric's crunch hits Crab
    function checkEricCrunchCollision() {
        // Check only if Crab is walking, Eric is crunching
        if (crab.visible && crab.state === 'walking' && eric.state === 'crunching') {
             // Define Eric's crunch hitbox based on direction
             let crunchHitboxRect;
             if (eric.facingRight) {
                 crunchHitboxRect = {
                     x: eric.x + eric.crunchHitboxOffsetX,
                     y: eric.y + eric.crunchHitboxOffsetY,
                     width: eric.crunchHitboxWidth,
                     height: eric.crunchHitboxHeight
                 };
             } else { // Facing left - mirrored hitbox
                 crunchHitboxRect = {
                    x: eric.x + eric.width - eric.crunchHitboxOffsetX - eric.crunchHitboxWidth, // Flipped X
                    y: eric.y + eric.crunchHitboxOffsetY,
                    width: eric.crunchHitboxWidth,
                    height: eric.crunchHitboxHeight
                 };
             }

             // Define Crab's hittable area
             const crabHitboxRect = {
                 x: crab.x + crab.hitboxOffsetX,
                 y: crab.y + crab.hitboxOffsetY,
                 width: crab.hitboxWidth,
                 height: crab.hitboxHeight
             };

             // AABB collision check
             if (crunchHitboxRect.x < crabHitboxRect.x + crabHitboxRect.width &&
                 crunchHitboxRect.x + crunchHitboxRect.width > crabHitboxRect.x &&
                 crunchHitboxRect.y < crabHitboxRect.y + crabHitboxRect.height &&
                 crunchHitboxRect.y + crunchHitboxRect.height > crabHitboxRect.y)
             {
                 // Collision detected! Now check timing for parry vs. normal crunch.

                 // Check if crunch is within the PARRY window (early frames of crunch)
                 const isParry = eric.actionDuration > 1 && eric.actionDuration <= PARRY_WINDOW + 1;

                 // Check if crunch is within the general active frames
                 const isCrunchActive = eric.actionDuration > 1 && eric.actionDuration <= CRUNCH_ACTIVE_FRAMES + 1;

                 const hitX = crunchHitboxRect.x + crunchHitboxRect.width / 2;
                 const hitY = crunchHitboxRect.y + crunchHitboxRect.height / 2;

                 if (isParry) {
                     console.log("Crunch PARRY Crab!");
                     parryCrab(hitX, hitY);
                 } else if (isCrunchActive) {
                     // Normal crunch hit if not a parry but still in active frames
                     console.log("Crunch HIT Crab!");
                     hitCrab(hitX, hitY);
                 }
                 // If not isCrunchActive, the collision happened too late in the animation.
             }
        }
    }

    // --- Hit Handling ---

    // Called when Mickey is successfully hit by a punch
    function hitMickey(hitX, hitY) {
        // Prevent multiple hits from one punch
        if (mickey.state === 'hit' || mickey.state === 'dying') return;

        mickeyHitCount++;
        score++;
        playSound('punch', 0.8); // Play punch sound
        triggerScreenShake(SCREEN_SHAKE_DURATION_HIT, SCREEN_SHAKE_MAGNITUDE_HIT);
        addFloatingScore("+1", hitX, hitY, 'white'); // Score popup

        mickey.aggressionLevel = Math.min(3, mickey.aggressionLevel + 0.5); // Increase aggression (visual/future use)

        // Check if this hit kills Mickey
        if (mickeyHitCount >= MICKEY_MAX_HITS) {
            mickey.state = 'dying';
            mickey.deathFrame = 0;
            mickey.deathAnimationDuration = 0;
            playSound('mickeyDeath'); // Play death sound
            triggerScreenShake(SCREEN_SHAKE_DURATION_KILL, SCREEN_SHAKE_MAGNITUDE_KILL);
            score += 15; // Bonus points for kill
            addFloatingScore("+15 BONUS!", hitX, hitY - 30, 'gold'); // Bonus score popup
            scoreColor = '#FFD700'; // Flash score gold
            setTimeout(() => { scoreColor = '#FFFFFF'; }, 500); // Reset score color

            // Trigger bonus visual slightly after hit
            setTimeout(() => {
                playSound('bonus');
                showBonus = true;
                bonusTimer = BONUS_DISPLAY_FRAMES;
            }, 300);
        } else { // Mickey survives the hit
            mickey.state = 'hit';
            mickey.hitDuration = 0; // Start hit stagger state
            // Play random Mickey noise
            const noiseIndex = assets.audio.currentMickeyNoiseIndex % assets.audio.mickeyNoises.length;
            const noiseKey = `mickeyNoise${noiseIndex + 1}`;
            playSound(noiseKey, 0.7 + mickey.aggressionLevel * 0.1); // Louder noise when more aggressive?
            assets.audio.currentMickeyNoiseIndex++;
        }

        // Trigger visual punch effect
        mickey.punchEffectIndex = Math.floor(Math.random() * punchEffectImages.length);
        mickey.punchEffectDuration = 0;
    }

    // Called for a normal (non-parry) crunch hit on the crab
    function hitCrab(hitX, hitY) {
         // Prevent multiple hits from one crunch or hitting dead/crunched crab
         if (crab.state !== 'walking') return;

         crab.hitCount++;
         // Play a generic hit sound? Or only sound on parry/kill?
         // playSound('crabHit', 0.6);
         triggerScreenShake(SCREEN_SHAKE_DURATION_HIT / 2, SCREEN_SHAKE_MAGNITUDE_HIT / 2); // Less shake for normal hit

         // Check if this hit kills the crab
         if (crab.hitCount >= CRAB_MAX_HITS) {
             crab.state = 'dying';
             crab.deathFrame = 0;
             crab.deathAnimationDuration = 0;
             score += 5; // Points for crab kill
             addFloatingScore("+5", hitX, hitY, 'lightgreen');
             scoreColor = '#90EE90'; // Flash score light green
             setTimeout(() => { scoreColor = '#FFFFFF'; }, 500);
             // Small kill shake
             triggerScreenShake(SCREEN_SHAKE_DURATION_HIT, SCREEN_SHAKE_MAGNITUDE_HIT);
             // Play kill sound? Separate from parry?
             // playSound('crabDie', 0.8);
         } else { // Crab survives the hit
             crab.state = 'crunched'; // Show brief visual stun
             crab.crunchDuration = 0;
             addFloatingScore("+0", hitX, hitY, '#AAAAAA'); // Indicate hit but no score
             // Apply knockback
             const knockbackDirection = eric.facingRight ? 1 : -1;
             crab.x += 40 * gameSpeed * knockbackDirection; // Push crab back
         }
     }

     // Called for a successful parry hit on the crab
     function parryCrab(hitX, hitY) {
         // Ensure crab is walking to be parried
         if (crab.state !== 'walking') return;

         crab.state = 'dying'; // Instantly dying on parry
         crab.deathFrame = 0; // Start death anim
         crab.deathAnimationDuration = 0;

         score += 10; // Bonus points for parry
         playSound('fuckCrab', 1.0); // Distinctive parry sound!
         triggerScreenShake(SCREEN_SHAKE_DURATION_KILL * 1.2, SCREEN_SHAKE_MAGNITUDE_KILL * 1.5); // Big shake!
         addFloatingScore("PARRY! +10", hitX, hitY - 20, 'cyan');
         scoreColor = '#00FFFF'; // Flash score cyan for parry
         setTimeout(() => { scoreColor = '#FFFFFF'; }, 600);

         // Maybe add a visual flash effect here?
         // e.g., draw a temporary white rectangle over the crab
     }

    // --- Respawn Logic ---

     // Reset and reposition Mickey after death or passing
     function respawnMickey() {
         let newX = canvas.width + Math.random() * 100; // Spawn just off-screen right

         // Ensure minimum gap from crab if crab is visible and near spawn area
         if (crab.visible && crab.x > canvas.width / 2) {
             // Ensure Mickey spawns further right than the crab + gap
             newX = Math.max(newX, crab.x + crab.width + MIN_ENEMY_SPAWN_GAP);
         }

         mickey.x = newX;
         mickey.y = canvas.height - ENEMY_Y_BOTTOM_OFFSET - mickey.drawHeight; // Reset Y just in case
         mickey.visible = true;
         mickey.state = 'walking';
         mickey.baseSpeed += 0.15; // Increase base speed slightly each respawn
         mickeyHitCount = 0; // Reset hits
         mickey.frameX = 0; // Reset animation
         mickey.deathAnimationDuration = 0;
         mickey.hitDuration = 0;
         mickey.punchEffectIndex = -1;
         mickey.aggressionLevel = 0; // Reset aggression
         console.log("Mickey respawned at", mickey.x.toFixed(0), "New base speed:", mickey.baseSpeed.toFixed(2));
     }

     // Reset and reposition Crab after death/despawn timer
     function respawnCrab() {
         let newX = canvas.width + Math.random() * 200; // Spawn just off-screen right

          // Ensure minimum gap from Mickey if Mickey is visible and near spawn area
          if (mickey.visible && mickey.x > canvas.width / 2) {
             newX = Math.max(newX, mickey.x + mickey.width + MIN_ENEMY_SPAWN_GAP);
         }

         crab.x = newX;
         crab.y = canvas.height - CRAB_Y_BOTTOM_OFFSET - crab.drawHeight; // Reset Y
         crab.visible = true;
         crab.state = 'walking';
         crab.hitCount = 0; // Reset hits
         crab.frameX = 0; // Reset animation
         crab.deathAnimationDuration = 0;
         crab.crunchDuration = 0;
         crab.baseSpeed += 0.1; // Crabs get slightly faster too
         crabTimer = 0; // Reset internal timer (redundant but safe)
         console.log("Crab respawned at", crab.x.toFixed(0), "New base speed:", crab.baseSpeed.toFixed(2));
     }

    // --- Draw Functions ---

    function drawBackground() {
        // Draw background images, repeating as they scroll
        if (assets.images.cloudBackground) {
            ctx.drawImage(assets.images.cloudBackground, cloudBackgroundX, 0, canvas.width, canvas.height);
            ctx.drawImage(assets.images.cloudBackground, cloudBackgroundX + canvas.width, 0, canvas.width, canvas.height);
        }
        if (assets.images.oceanBackground) {
            ctx.drawImage(assets.images.oceanBackground, oceanBackgroundX, 0, canvas.width, canvas.height);
            ctx.drawImage(assets.images.oceanBackground, oceanBackgroundX + canvas.width, 0, canvas.width, canvas.height);
        }
    }

    function drawEric() {
        ctx.save(); // Save context state before potential flipping

        // Determine which image to draw based on state
        let currentImage = null;
        switch (eric.state) {
            case 'punching':
                currentImage = eric.currentPunchImage; // Should be set when punch starts
                break;
            case 'crunching':
                currentImage = eric.crunchImage;
                break;
            case 'pinched':
                currentImage = eric.pinchedImage;
                break;
            case 'walking':
            default:
                // Ensure walkImages array and frameX are valid
                 if (eric.walkImages && eric.walkImages.length > eric.frameX) {
                     currentImage = eric.walkImages[eric.frameX];
                 } else if (eric.walkImages && eric.walkImages.length > 0) {
                     currentImage = eric.walkImages[0]; // Fallback to first frame
                 }
                break;
        }

        // Fallback if image somehow missing
        if (!currentImage) {
             if (eric.walkImages && eric.walkImages.length > 0) currentImage = eric.walkImages[0];
             // console.warn("Eric currentImage is missing, falling back.");
        }

        // Handle flipping
        let drawX = eric.x;
        if (!eric.facingRight) {
            ctx.scale(-1, 1); // Flip horizontally
            // Adjust X position for flipped drawing: draw at -(originalX + width)
            drawX = -eric.x - eric.width;
        }

        // Draw the determined image
        if (currentImage) {
            try {
                // Draw the full sprite sheet/frame
                ctx.drawImage(currentImage, drawX, eric.y, eric.width, eric.height);
            } catch (e) {
                console.error("Error drawing Eric:", e, "Image:", currentImage);
                // Draw placeholder if image fails
                 ctx.fillStyle = 'magenta';
                 ctx.fillRect(drawX, eric.y, 50, 100); // Simple placeholder
            }
        }

        // --- DEBUG: Draw Hitboxes (coordinates relative to flipped/unflipped state) ---
        if (debugMode) {
            ctx.lineWidth = 2;
            // Punch Hitbox (only drawn when punching)
            if (eric.state === 'punching') {
                ctx.strokeStyle = 'red';
                let pX = drawX + (eric.facingRight ? eric.punchHitboxOffsetX : eric.width - eric.punchHitboxOffsetX - eric.punchHitboxWidth);
                let pY = eric.y + eric.punchHitboxOffsetY;
                ctx.strokeRect(pX, pY, eric.punchHitboxWidth, eric.punchHitboxHeight);
            }
            // Crunch Hitbox (only drawn when crunching)
            if (eric.state === 'crunching') {
                 ctx.strokeStyle = 'blue';
                 let cX = drawX + (eric.facingRight ? eric.crunchHitboxOffsetX : eric.width - eric.crunchHitboxOffsetX - eric.crunchHitboxWidth);
                 let cY = eric.y + eric.crunchHitboxOffsetY;
                 ctx.strokeRect(cX, cY, eric.crunchHitboxWidth, eric.crunchHitboxHeight);

                 // Indicate Parry window with Cyan border
                 if (eric.actionDuration > 1 && eric.actionDuration <= PARRY_WINDOW + 1) {
                     ctx.strokeStyle = 'cyan';
                     ctx.strokeRect(cX - 3, cY - 3, eric.crunchHitboxWidth + 6, eric.crunchHitboxHeight + 6);
                 }
            }
             // Draw Eric's base bounding box (helpful for positioning)
             ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
             ctx.lineWidth = 1;
             ctx.strokeRect(drawX, eric.y, eric.width, eric.height);
             // Draw derived visual bounding box
             ctx.strokeStyle = 'rgba(0, 255, 0, 0.6)';
              ctx.strokeRect(drawX, eric.y, eric.width, eric.drawHeight);


        }
        // --- END DEBUG ---

        ctx.restore(); // Restore context state (removes flip if applied)
    }

     function drawMickey() {
         if (!mickey.visible) return; // Don't draw if invisible

         let currentImage = null;
         // Determine image based on state
         switch (mickey.state) {
             case 'walking':
                if (mickey.walkImages && mickey.walkImages.length > mickey.frameX)
                    currentImage = mickey.walkImages[mickey.frameX];
                else if (mickey.walkImages && mickey.walkImages.length > 0)
                    currentImage = mickey.walkImages[0];
                 break;
             case 'hit':
                 currentImage = mickey.hitImage;
                 break;
             case 'dying':
                 if (mickey.dieImages && mickey.dieImages.length > mickey.deathFrame)
                    currentImage = mickey.dieImages[mickey.deathFrame];
                 else if (mickey.dieImages && mickey.dieImages.length > 0)
                    currentImage = mickey.dieImages[0];
                 break;
         }

         // Fallback
         if (!currentImage && mickey.walkImages && mickey.walkImages.length > 0) {
             currentImage = mickey.walkImages[0];
             // console.warn("Mickey currentImage missing, falling back.");
         }

         // Apply aggression visual tint if applicable
         let appliedFilter = false;
         if (mickey.aggressionLevel > 1 && currentImage) {
              ctx.save();
              // Apply a subtle red hue shift and saturation boost
              ctx.filter = `hue-rotate(-${mickey.aggressionLevel * 4}deg) saturate(1.${Math.floor(mickey.aggressionLevel)}) brightness(0.95)`;
              appliedFilter = true;
          }

         // Draw Mickey's image
         if (currentImage) {
              try {
                  ctx.drawImage(currentImage, mickey.x, mickey.y, mickey.width, mickey.height);
              } catch (e) {
                   console.error("Error drawing Mickey:", e, "Image:", currentImage);
                   ctx.fillStyle = 'purple'; ctx.fillRect(mickey.x, mickey.y, 50, 100); // Placeholder
              }
         }

         // Restore filter if applied
         if (appliedFilter) {
             ctx.restore();
         }

         // Draw punch effect if active
         if (mickey.punchEffectIndex !== -1 && punchEffectImages.length > mickey.punchEffectIndex) {
              const effectImage = punchEffectImages[mickey.punchEffectIndex];
              if (effectImage) {
                  // Center effect roughly on Mickey's hitbox center
                  const effectX = mickey.x + mickey.hitboxOffsetX + (mickey.hitboxWidth / 2) - 100; // Assuming effect is 200x200
                  const effectY = mickey.y + mickey.hitboxOffsetY + (mickey.hitboxHeight / 2) - 100;
                  const scale = 1.0 + Math.random() * 0.1; // Slight random scale
                   try {
                       ctx.drawImage(effectImage, effectX, effectY, 200 * scale, 200 * scale);
                   } catch(e) { console.error("Error drawing punch effect:", e); }
              }
         }

         // --- DEBUG: Draw Hitbox ---
         if (debugMode) {
             ctx.strokeStyle = 'lime';
             ctx.lineWidth = 1;
             ctx.strokeRect(mickey.x + mickey.hitboxOffsetX, mickey.y + mickey.hitboxOffsetY, mickey.hitboxWidth, mickey.hitboxHeight);
             // Draw base bounding box
             ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
             ctx.strokeRect(mickey.x, mickey.y, mickey.width, mickey.height);
             // Draw derived visual bounding box
             ctx.strokeStyle = 'rgba(0, 255, 0, 0.6)';
             ctx.strokeRect(mickey.x, mickey.y, mickey.width, mickey.drawHeight);

         }
         // --- END DEBUG ---
     }

      function drawCrab() {
         if (!crab.visible) return;

         let currentImage = null;
         // Determine image based on state
         switch (crab.state) {
             case 'walking':
                 if (crab.walkImages && crab.walkImages.length > crab.frameX)
                     currentImage = crab.walkImages[crab.frameX];
                 else if (crab.walkImages && crab.walkImages.length > 0)
                     currentImage = crab.walkImages[0];
                 break;
             case 'crunched':
                 currentImage = crab.crunchImage;
                 break;
             case 'dying':
                 if (crab.dieImages && crab.dieImages.length > crab.deathFrame)
                     currentImage = crab.dieImages[crab.deathFrame];
                 else if (crab.dieImages && crab.dieImages.length > 0)
                     currentImage = crab.dieImages[0];
                 break;
         }

          // Fallback
          if (!currentImage && crab.walkImages && crab.walkImages.length > 0) {
              currentImage = crab.walkImages[0];
              // console.warn("Crab currentImage missing, falling back.");
          }

          // Draw crab image
          if (currentImage) {
              try {
                  ctx.drawImage(currentImage, crab.x, crab.y, crab.width, crab.height);
              } catch (e) {
                   console.error("Error drawing Crab:", e, "Image:", currentImage);
                   ctx.fillStyle = 'orange'; ctx.fillRect(crab.x, crab.y, 80, 40); // Placeholder
              }
          }

          // --- DEBUG: Draw Hitbox ---
          if (debugMode) {
              ctx.strokeStyle = 'yellow';
              ctx.lineWidth = 1;
              ctx.strokeRect(crab.x + crab.hitboxOffsetX, crab.y + crab.hitboxOffsetY, crab.hitboxWidth, crab.hitboxHeight);
              // Draw base bounding box
             ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
             ctx.strokeRect(crab.x, crab.y, crab.width, crab.height);
             // Draw derived visual bounding box
             ctx.strokeStyle = 'rgba(0, 255, 0, 0.6)';
             ctx.strokeRect(crab.x, crab.y, crab.width, crab.drawHeight);
          }
          // --- END DEBUG ---
     }

     // Draw the score display
     function drawScore() {
        const scoreText = `Score: ${score}`;
        ctx.font = 'bold 24px Arial'; // Make score slightly larger
        const textMetrics = ctx.measureText(scoreText);
        const padding = 10;
        const boxWidth = textMetrics.width + padding * 2;
        const boxHeight = 35; // Taller box for larger font
        const boxX = canvas.width - boxWidth - 15; // Position top-right
        const boxY = 10;
        const textX = boxX + padding;
        const textY = boxY + boxHeight / 2 + 8; // Adjust vertical alignment

        // Draw background box for score
        ctx.fillStyle = 'rgba(30, 144, 255, 0.7)'; // Semi-transparent blue
        ctx.fillRect(boxX, boxY, boxWidth, boxHeight);

        // Draw score text
        ctx.fillStyle = scoreColor; // Use dynamic color (flashes on bonuses)
        ctx.textAlign = 'left'; // Align text correctly within the box
        ctx.fillText(scoreText, textX, textY);
    }

    // Draw the on-canvas instructions temporarily
    function drawInstructions() {
        if (showInstructions) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.75)'; // Darker background
            ctx.fillRect(canvas.width / 2 - 260, 30, 520, 110); // Centered box

            ctx.fillStyle = 'white';
            ctx.font = 'bold 22px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('Punch Shark: [SPACE]', canvas.width / 2, 65);
            ctx.fillText('Crunch/Parry Crab: [DOWN]', canvas.width / 2, 95);
            ctx.fillText('Turn: [LEFT] / [RIGHT] Arrows', canvas.width / 2, 125);
            ctx.textAlign = 'left'; // Reset alignment
        }
    }

    // Draw the "BONUS!" image when triggered
    function drawBonus() {
        if (showBonus && assets.images.bonus) {
            try {
                 // Draw centered bonus image
                ctx.drawImage(assets.images.bonus, canvas.width / 2 - 100, canvas.height / 2 - 100, 200, 200);
            } catch (e) { console.error("Error drawing Bonus image:", e); }
        }
    }


    // --- Event Listeners ---
    function handleKeyDown(event) {
         // Attempt to start music/game on first keydown if not running
         if (!gameRunning && assets.audio.gameMusic) {
             // userInteractionStart will handle the actual start
             return; // Let the interaction listener handle the first key press
         }
         if (!gameRunning) return; // Ignore input if game isn't running yet

         // --- Turning ---
         // Allow turning anytime (even during actions)
          if (event.code === 'ArrowLeft') {
              if (eric.facingRight) {
                  // console.log("Turning Left");
                  eric.facingRight = false;
              }
          } else if (event.code === 'ArrowRight') {
              if (!eric.facingRight) {
                   // console.log("Turning Right");
                   eric.facingRight = true;
              }
          }

         // --- Actions (Punch/Crunch) ---
         // Only allow starting a new action if Eric is currently 'walking'
         if (eric.state === 'walking') {
             switch (event.code) {
                 case 'Space': // Punch
                     eric.state = 'punching';
                     eric.actionDuration = 0; // Reset action timer
                     // Select random punch image
                     eric.currentPunchImage = eric.punchImages[Math.floor(Math.random() * eric.punchImages.length)];
                     // console.log("Action: Punch Start");
                     // Sound played on successful hit in hitMickey()
                     break;
                 case 'ArrowDown': // Crunch / Parry attempt
                     eric.state = 'crunching';
                     eric.actionDuration = 0; // Reset action timer
                     // console.log("Action: Crunch Start");
                     // Sound played on successful hit/parry
                     break;
             }
         }

         // --- Debug Toggle ---
         if (event.code === 'KeyD') {
             debugMode = !debugMode;
             console.log("Debug mode toggled:", debugMode);
         }
    }
    // Add keydown listener to the document
    document.addEventListener('keydown', handleKeyDown);

     // Listener to start the game/audio on first user interaction
     function userInteractionStart(event) {
         console.log(`User interaction detected (${event.type}). Attempting to start music/game.`);
         // Try starting music (which then starts the game)
         if (!gameRunning) { // Prevent multiple starts
            startGameMusic();
         }

         // Clean up interaction listeners - important!
         document.removeEventListener('click', userInteractionStart);
         document.removeEventListener('keydown', userInteractionStart);
         console.log("Interaction listeners removed.");
     }
     // Attach listeners for first interaction
     document.addEventListener('click', userInteractionStart, { once: true }); // Use 'once' for automatic removal
     document.addEventListener('keydown', userInteractionStart, { once: true });


    // --- Game Initialization ---

     // Attempts to play background music, then starts the game loop
     function startGameMusic() {
        const music = assets.audio.gameMusic;
        if (!music) {
            console.warn("Game music asset not found. Starting game without music.");
             if (!gameRunning) startGame(); // Start game anyway
            return;
        }

        if (music.paused) {
            music.play()
                .then(() => {
                    console.log("Game music started successfully.");
                    if (!gameRunning) startGame(); // Start game after music starts
                })
                .catch(e => {
                    console.error("Error playing game music:", e);
                    // If play fails (e.g., browser restriction still), start game anyway
                    if (!gameRunning) {
                         console.warn("Starting game without music due to playback error.");
                         startGame();
                    }
                });
        } else {
             // Music might already be playing if interaction happened quickly
              if (!gameRunning) startGame();
        }
    }

     // Initializes game state and starts the main loop
     function startGame() {
         if (gameRunning) {
             console.warn("Start game called but already running.");
             return;
         }
         console.log("Starting game loop - Creative Overhaul...");

         // Reset Core Game State Variables
         score = 0;
         gameSpeed = 1;
         frameCount = 0;
         gameStartTime = Date.now(); // Set start time for instruction timer
         mickeyHitCount = 0;
         mickey.baseSpeed = 2.2; // Reset speeds
         crab.baseSpeed = 3.5;
         floatingScores = []; // Clear score popups
         screenShake = { duration: 0, magnitude: 0 }; // Reset screen shake
         showInstructions = true; // Show instructions again
         scoreColor = '#FFFFFF'; // Reset score color


         // Reset Player State
         eric.x = 100; // Reset position
         eric.y = canvas.height - PLAYER_Y_BOTTOM_OFFSET - eric.drawHeight;
         eric.state = 'walking';
         eric.facingRight = true;
         eric.actionDuration = 0;
         eric.frameX = 0;


         // Reset Enemies
         // Make sure they are properly hidden/reset before first spawn timer kicks in
         mickey.visible = false;
         mickey.state = 'walking'; // Ensure state reset
         mickey.x = canvas.width + 100; // Position off-screen
         setTimeout(respawnMickey, 1500); // Delay initial Mickey spawn slightly longer

         crab.visible = false;
         crab.state = 'walking';
         crab.x = canvas.width + 100; // Position off-screen
         crabTimer = 0; // Reset spawn timer so it starts counting

         gameRunning = true; // Set flag to allow game loop to run
         lastFrameTime = performance.now(); // Initialize last frame time for potential deltaTime usage
         requestAnimationFrame(gameLoop); // Start the loop!
     }

    // --- Load assets and prepare for game start ---
    console.log("Loading assets...");
    // Display loading message on canvas
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'white';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Loading Assets...', canvas.width / 2, canvas.height / 2);
    ctx.textAlign = 'left'; // Reset

    loadGameAssets()
        .then(() => {
            console.log("All asset loading promises resolved.");
            // Now try to assign assets
            if (assignAssets()) { // Check if assignment was successful
                console.log("Assets assigned. Ready for user interaction.");
                // Clear loading message and show "Click to Start"
                ctx.fillStyle = '#87CEEB'; // Clear with background color
                ctx.fillRect(0,0, canvas.width, canvas.height); // Clear canvas
                // Draw initial background frame maybe?
                drawBackground();

                ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
                ctx.fillRect(canvas.width/2 - 150, canvas.height/2 - 40, 300, 80);
                ctx.fillStyle = 'white';
                ctx.font = 'bold 24px Arial';
                ctx.textAlign = 'center';
                ctx.fillText('Click or Press Key', canvas.width / 2, canvas.height / 2 - 5);
                ctx.fillText('to Start!', canvas.width / 2, canvas.height / 2 + 25);
                ctx.textAlign = 'left'; // Reset
                // Now wait for userInteractionStart listener
            } else {
                 // assignAssets logged an error and drew on canvas
                 console.error("Asset assignment failed. Game cannot start.");
            }
        })
        .catch(error => {
            // This catches errors from loadImage promises (like 404s)
            console.error("Fatal error during asset loading:", error);
             ctx.fillStyle = 'red'; ctx.font = 'bold 18px Arial'; ctx.textAlign = 'center';
             ctx.fillText('Error loading game assets. Check console & refresh.', canvas.width / 2, canvas.height / 2 + 40);
             ctx.textAlign = 'left'; // Reset
        });

    console.log("Game script finished initial setup - waiting for assets and interaction.");

}); // End DOMContentLoaded
