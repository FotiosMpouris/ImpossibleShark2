console.log("Game script started");

document.addEventListener('DOMContentLoaded', function() {
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
    const GROUND_HEIGHT = 100;
    const PLAYER_START_X = -300;
    const PLAYER_Y_OFFSET = 400; // Distance from ground
    const ENEMY_Y_OFFSET = 400;  // Distance from ground for Mickey
    const CRAB_Y_OFFSET = 300;   // Distance from ground for Crab
    const MICKEY_MAX_HITS = 6;
    const CRAB_MAX_HITS = 2;     // Hits needed to kill crab
    const PUNCH_ACTIVE_START_FRAME = 5;
    const PUNCH_ACTIVE_END_FRAME = 20;
    const CRUNCH_ACTIVE_START_FRAME = 5;
    const CRUNCH_ACTIVE_END_FRAME = 20;
    const ACTION_DURATION_FRAMES = 30; // Duration for punch, crunch, pinch, hit stun etc.
    const HIT_STAGGER_FRAMES = 30;
    const DEATH_ANIMATION_FRAMES = 60;
    const BONUS_DISPLAY_FRAMES = 60;
    const INITIAL_CRAB_SPAWN_INTERVAL = 1200; // Frames
    const GAME_SPEED_INCREASE = 0.0003;
    const INSTRUCTION_DISPLAY_DURATION_MS = 8000; // Show instructions for 8 seconds

    // --- Game State Variables ---
    let gameSpeed = 1;
    let score = 0;
    let frameCount = 0;
    let gameStartTime = Date.now();
    let mickeyHitCount = 0;
    let scoreColor = 'white'; // Changed default for better visibility on background
    let showInstructions = true;
    let crabTimer = 0; // Frames until next crab might spawn
    let showBonus = false;
    let bonusTimer = 0; // Frames bonus is shown
    let gameRunning = false; // Flag to control game loop start

    // --- Utility Functions ---
    const getCrabSpawnInterval = () => Math.floor(INITIAL_CRAB_SPAWN_INTERVAL / gameSpeed);

    // --- Asset Loading ---
    const assets = {
        images: {},
        audio: {}
    };

    function loadImage(key, src) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            assets.images[key] = img;
            img.onload = () => resolve(img);
            img.onerror = () => {
                console.error(`Failed to load image: ${src}`);
                reject(`Failed to load image: ${src}`);
            };
            img.src = src;
        });
    }

    function loadAudio(key, src, loop = false) {
        return new Promise((resolve, reject) => {
            const audio = new Audio(src);
            assets.audio[key] = audio;
            audio.loop = loop;
            audio.addEventListener('canplaythrough', () => resolve(audio), { once: true });
            audio.onerror = (e) => {
                console.error(`Failed to load audio: ${src}`, e);
                // Don't reject, allow game to potentially continue without this sound
                resolve(audio);
            };
            // Preload attempt
            audio.load();
        });
    }

    // --- Background ---
    let oceanBackgroundX = 0;
    let cloudBackgroundX = 0;

    // --- Eric (Player) ---
    const eric = {
        x: PLAYER_START_X,
        y: canvas.height - GROUND_HEIGHT - PLAYER_Y_OFFSET,
        width: 900,
        height: 500,
        frameX: 0,
        frameY: 0, // Keep for potential future use (e.g., different animations)
        animationFrame: 0,
        animationDelay: 15, // Update frame every 15 game frames
        state: 'walking', // walking, punching, crunching, pinched
        actionDuration: 0,
        // Hitboxes
        punchHitboxWidth: 100,
        punchHitboxOffset: 700, // Offset from eric.x
        crunchHitboxWidth: 100,
        crunchHitboxOffset: 700, // Offset from eric.x
        // Images
        walkImages: [],
        punchImages: [],
        crunchImage: null,
        pinchedImage: null,
        currentPunchImage: null
    };

    // --- Mickey (Enemy 1) ---
    const mickey = {
        x: canvas.width,
        y: canvas.height - GROUND_HEIGHT - ENEMY_Y_OFFSET,
        width: 900,
        height: 500,
        frameX: 0,
        animationFrame: 0,
        animationDelay: 5, // Faster animation
        baseSpeed: 2,
        speed: 2,
        visible: true,
        state: 'walking', // walking, hit, dying
        hitDuration: 0,
        deathFrame: 0,
        deathAnimationDuration: 0,
        // Hitbox (relative to mickey.x)
        hitboxWidth: 100,
        hitboxOffset: 400,
        // Images / Effects
        walkImages: [],
        hitImage: null,
        dieImages: [],
        punchEffectIndex: -1,
        punchEffectDuration: 0
    };

    // --- Crab (Enemy 2) ---
    const crab = {
        x: canvas.width,
        y: canvas.height - GROUND_HEIGHT - CRAB_Y_OFFSET,
        width: 1000, // Crabs are wide!
        height: 500,
        frameX: 0,
        animationFrame: 0,
        animationDelayBase: 10,
        baseSpeed: 3,
        speed: 3,
        visible: false, // Starts invisible
        state: 'walking', // walking, crunched, dying
        hitCount: 0,
        deathFrame: 0,
        deathAnimationDuration: 0,
        crunchDuration: 0, // Duration of the 'crunched' state visual
        // Hitbox (use x and width directly, covers most of the sprite width for simplicity)
        // Images
        walkImages: [],
        crunchImage: null,
        dieImages: []
    };

    // --- Punch Effects ---
    const punchEffectImages = [];

    // --- Load All Assets ---
    function loadGameAssets() {
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

        // Eric Walk
        for (let i = 1; i <= 8; i++) {
            imagePromises.push(loadImage(`ericRun${i}`, `assets/EricRun${i}.png`));
        }
        // Mickey Walk
        for (let i = 1; i <= 21; i++) {
            imagePromises.push(loadImage(`mickeyWalk${i}`, `assets/MickeyWalk${i.toString().padStart(2, '0')}.png`));
        }
        // Mickey Die
        for (let i = 1; i <= 3; i++) {
            imagePromises.push(loadImage(`mickeyDie${i}`, `assets/MickeyDie${i}.png`));
        }
        // Crab Walk
        for (let i = 1; i <= 5; i++) {
            imagePromises.push(loadImage(`crabWalk${i}`, `assets/crabWalk${i}.png`));
        }
        // Crab Die
        for (let i = 1; i <= 3; i++) {
            imagePromises.push(loadImage(`crabDead${i}`, `assets/crabDead${i}.png`));
        }
        // Punch Effects
        for (let i = 1; i <= 3; i++) {
            imagePromises.push(loadImage(`punchEffect${i}`, `assets/PunchEffect${i}.png`));
        }

        const audioPromises = [
            loadAudio('punch', 'assets/PunchSound.mp3'),
            loadAudio('fuckCrab', 'assets/fuckCrab.mp3'),
            loadAudio('ericOuch', 'assets/ericOuch.mp3'),
            loadAudio('mickeyDeath', 'assets/deathSound.mp3'),
            loadAudio('bonus', 'assets/bonusSound.mp3'),
            loadAudio('gameMusic', 'assets/GameMusic.mp3', true) // Loop music
        ];
        // Mickey Noises
        for (let i = 1; i <= 7; i++) {
            audioPromises.push(loadAudio(`mickeyNoise${i}`, `assets/MickeyNoise${i}.mp3`));
        }

        return Promise.all([...imagePromises, ...audioPromises]);
    }

    // --- Assign Loaded Assets ---
    function assignAssets() {
        // Backgrounds are used directly via assets.images['oceanBackground'] etc.

        // Eric
        for (let i = 1; i <= 8; i++) eric.walkImages.push(assets.images[`ericRun${i}`]);
        eric.punchImages.push(assets.images['ericPunch1']);
        eric.punchImages.push(assets.images['ericPunch2']);
        eric.crunchImage = assets.images['ericCrunch'];
        eric.pinchedImage = assets.images['ericPinched'];

        // Mickey
        for (let i = 1; i <= 21; i++) mickey.walkImages.push(assets.images[`mickeyWalk${i}`]);
        mickey.hitImage = assets.images['mickeyHit'];
        for (let i = 1; i <= 3; i++) mickey.dieImages.push(assets.images[`mickeyDie${i}`]);

        // Crab
        for (let i = 1; i <= 5; i++) crab.walkImages.push(assets.images[`crabWalk${i}`]);
        crab.crunchImage = assets.images['crabCrunch'];
        for (let i = 1; i <= 3; i++) crab.dieImages.push(assets.images[`crabDead${i}`]);

        // Punch Effects
        for (let i = 1; i <= 3; i++) punchEffectImages.push(assets.images[`punchEffect${i}`]);

        // Sounds are accessed via assets.audio['key']
        assets.audio.mickeyNoises = [];
        for (let i = 1; i <= 7; i++) assets.audio.mickeyNoises.push(assets.audio[`mickeyNoise${i}`]);
        assets.audio.currentMickeyNoiseIndex = 0;
    }

    // --- Sound Playback Helper ---
    function playSound(key) {
        const sound = assets.audio[key];
        if (sound && sound.readyState >= 3) { // HAVE_FUTURE_DATA or more
            sound.currentTime = 0; // Rewind before playing
            sound.play().catch(e => {
                // Ignore errors often caused by rapid playback attempts
                // console.warn(`Could not play sound "${key}":`, e.name);
            });
        } else {
            // console.warn(`Sound "${key}" not ready or not found.`);
        }
    }

    // --- Game Loop ---
    function gameLoop() {
        if (!gameRunning) return; // Stop loop if game isn't running

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Updates
        updateBackground();
        updateEric();
        updateMickey();
        updateCrab();
        updateGameSpeedAndScore(); // Contains frameCount++

        // Drawing
        drawBackground();
        drawCrab(); // Draw crab behind Mickey/Eric
        drawMickey();
        drawEric();
        drawScore();
        drawInstructions();
        if (showBonus) drawBonus();

        requestAnimationFrame(gameLoop);
    }

    // --- Update Functions ---
    function updateGameSpeedAndScore() {
        gameSpeed += GAME_SPEED_INCREASE;
        frameCount++;
        // Maybe cap gameSpeed? e.g., gameSpeed = Math.min(gameSpeed, MAX_GAME_SPEED);

        if (showInstructions && (Date.now() - gameStartTime > INSTRUCTION_DISPLAY_DURATION_MS)) {
            showInstructions = false;
        }
    }

    function updateBackground() {
        oceanBackgroundX -= gameSpeed * 1.0; // Ocean moves faster
        if (oceanBackgroundX <= -canvas.width) {
            oceanBackgroundX += canvas.width; // Use += to avoid potential gaps if speed is high
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
            if (eric.actionDuration > ACTION_DURATION_FRAMES) {
                eric.state = 'walking';
                eric.actionDuration = 0;
            }
        }

        // Animation
        if (eric.state === 'walking') {
            eric.animationFrame++;
            if (eric.animationFrame >= eric.animationDelay) {
                eric.frameX = (eric.frameX + 1) % eric.walkImages.length;
                eric.animationFrame = 0;
            }
        }
        // No movement for Eric in this game type
    }

    function updateMickey() {
        if (!mickey.visible) return;

        mickey.speed = mickey.baseSpeed * gameSpeed; // Scale speed

        switch (mickey.state) {
            case 'walking':
                mickey.x -= mickey.speed;
                // Animation
                mickey.animationFrame++;
                if (mickey.animationFrame >= mickey.animationDelay) {
                    mickey.frameX = (mickey.frameX + 1) % mickey.walkImages.length;
                    mickey.animationFrame = 0;
                }
                // Check if passed Eric (missed)
                if (mickey.x + mickey.width < 0) { // Check if entire sprite is off-screen left
                    respawnMickey(); // Or maybe game over? Currently respawns.
                }
                break;

            case 'hit':
                mickey.hitDuration++;
                // Stagger back slightly
                if (mickey.hitDuration <= HIT_STAGGER_FRAMES) {
                    mickey.x += mickey.speed * 0.5; // Move back slower than forward speed
                }
                // Recover after duration
                if (mickey.hitDuration > ACTION_DURATION_FRAMES) {
                    mickey.state = 'walking';
                    mickey.hitDuration = 0;
                }
                break;

            case 'dying':
                mickey.deathAnimationDuration++;
                // Cycle through death frames
                const deathFrameDelay = DEATH_ANIMATION_FRAMES / mickey.dieImages.length;
                mickey.deathFrame = Math.min(Math.floor(mickey.deathAnimationDuration / deathFrameDelay), mickey.dieImages.length - 1);

                if (mickey.deathAnimationDuration > DEATH_ANIMATION_FRAMES) {
                    respawnMickey();
                }
                break;
        }

        // Update Punch Effect display time
        if (mickey.punchEffectIndex !== -1) {
            mickey.punchEffectDuration++;
            if (mickey.punchEffectDuration > ACTION_DURATION_FRAMES / 2) { // Shorter duration for effect
                mickey.punchEffectIndex = -1;
                mickey.punchEffectDuration = 0;
            }
        }

        // Collision Check with Eric's Punch
        checkEricPunchCollision();
    }

    function updateCrab() {
        if (crab.visible) {
            crab.speed = crab.baseSpeed * gameSpeed; // Scale speed
            const currentAnimationDelay = Math.max(1, Math.floor(crab.animationDelayBase / gameSpeed));

            switch (crab.state) {
                case 'walking':
                    crab.x -= crab.speed;
                    // Animation
                    crab.animationFrame++;
                    if (crab.animationFrame >= currentAnimationDelay) {
                        crab.frameX = (crab.frameX + 1) % crab.walkImages.length;
                        crab.animationFrame = 0;
                    }
                    // Check if passed Eric
                    if (crab.x + crab.width < eric.x + 300) { // If crab's back edge passes Eric's front area
                         if (!eric.pinched) { // Only trigger pinch and sound once
                            crabPassed();
                        }
                    }
                     if (crab.x + crab.width < 0) { // Fully off screen
                        crab.visible = false; // Disappears without penalty if already pinched Eric
                        crabTimer = 0; // Reset spawn timer
                    }
                    break;

                case 'crunched':
                    crab.crunchDuration++;
                    // Stays in place, shows crunch image
                    if (crab.crunchDuration > ACTION_DURATION_FRAMES) {
                        crab.state = 'walking'; // Return to walking after being crunched
                        crab.crunchDuration = 0;
                    }
                    break;

                case 'dying':
                    crab.deathAnimationDuration++;
                    // Cycle through death frames
                    const deathFrameDelay = DEATH_ANIMATION_FRAMES / crab.dieImages.length;
                    crab.deathFrame = Math.min(Math.floor(crab.deathAnimationDuration / deathFrameDelay), crab.dieImages.length - 1);

                    if (crab.deathAnimationDuration > DEATH_ANIMATION_FRAMES) {
                        crab.visible = false;
                        crab.hitCount = 0; // Reset for next spawn
                        crabTimer = 0; // Reset spawn timer
                    }
                    break;
            }

            // Collision Check with Eric's Crunch
            checkEricCrunchCollision();

        } else {
            // Crab Spawning Logic
            crabTimer++;
            if (crabTimer >= getCrabSpawnInterval()) {
                respawnCrab();
            }
        }
    }

     function crabPassed() {
        crab.visible = false; // Crab disappears immediately after pinching
        eric.state = 'pinched';
        eric.actionDuration = 0;
        score = Math.max(0, score - 5); // Subtract 5 points, min 0
        playSound('ericOuch');
        crabTimer = 0; // Reset spawn timer
    }

    // --- Collision Detection ---
    function checkEricPunchCollision() {
        if (mickey.visible && mickey.state === 'walking' &&
            eric.state === 'punching' &&
            eric.actionDuration >= PUNCH_ACTIVE_START_FRAME &&
            eric.actionDuration <= PUNCH_ACTIVE_END_FRAME)
        {
            // Define hitboxes for collision check
            const punchHitbox = {
                x: eric.x + eric.punchHitboxOffset,
                y: eric.y, // Assume full height for simplicity or refine Y
                width: eric.punchHitboxWidth,
                height: eric.height
            };
            const mickeyHitbox = {
                x: mickey.x + mickey.hitboxOffset,
                y: mickey.y, // Assume full height
                width: mickey.hitboxWidth,
                height: mickey.height
            };

            // Simple AABB collision check
            if (punchHitbox.x < mickeyHitbox.x + mickeyHitbox.width &&
                punchHitbox.x + punchHitbox.width > mickeyHitbox.x &&
                punchHitbox.y < mickeyHitbox.y + mickeyHitbox.height &&
                punchHitbox.y + punchHitbox.height > mickeyHitbox.y)
            {
                // Push Mickey back slightly so he doesn't immediately get hit again
                 mickey.x = punchHitbox.x + punchHitbox.width - mickey.hitboxOffset + 10; // Move mickey just past the punch zone
                hitMickey();
            }
        }
    }

    function checkEricCrunchCollision() {
        if (crab.visible && crab.state === 'walking' &&
            eric.state === 'crunching' &&
            eric.actionDuration >= CRUNCH_ACTIVE_START_FRAME &&
            eric.actionDuration <= CRUNCH_ACTIVE_END_FRAME)
        {
            // Define hitboxes
            // Crunch hitbox seems to be similar to punch
             const crunchHitbox = {
                x: eric.x + eric.crunchHitboxOffset,
                y: eric.y + eric.height * 0.7, // Crunch lower? Adjust Y as needed
                width: eric.crunchHitboxWidth,
                height: eric.height * 0.3 // Crunch lower? Adjust height as needed
            };
            // Crab hitbox - make it slightly smaller than visual to require better aim
            const crabHitbox = {
                x: crab.x + crab.width * 0.2, // Start hitbox 20% in
                y: crab.y,
                width: crab.width * 0.6, // Hitbox covers middle 60%
                height: crab.height * 0.5 // Hitbox covers lower half? Adjust as needed
            };

             // AABB collision check
            if (crunchHitbox.x < crabHitbox.x + crabHitbox.width &&
                crunchHitbox.x + crunchHitbox.width > crabHitbox.x &&
                crunchHitbox.y < crabHitbox.y + crabHitbox.height &&
                crunchHitbox.y + crunchHitbox.height > crabHitbox.y)
             {
                hitCrab();
                 // Optional: push crab back slightly?
                 // crab.x += 10;
             }
        }
    }


    // --- Hit Handling ---
    function hitMickey() {
        mickeyHitCount++;
        score++;
        playSound('punch'); // Play punch sound on hit connect

        if (mickeyHitCount >= MICKEY_MAX_HITS) {
            mickey.state = 'dying';
            mickey.deathFrame = 0;
            mickey.deathAnimationDuration = 0;
            playSound('mickeyDeath');
            // Bonus awarded after death animation finishes? Or immediately?
            // Let's award immediately for feel, but show bonus graphic later.
            score += 10; // Bonus points for kill
            scoreColor = 'gold'; // Flash color
            setTimeout(() => { scoreColor = 'white'; }, 500); // Reset color

            // Delayed Bonus Visual/Sound
            setTimeout(() => {
                playSound('bonus');
                showBonus = true;
                bonusTimer = BONUS_DISPLAY_FRAMES;
            }, 500); // Delay bonus visual slightly after death sound

        } else {
            mickey.state = 'hit';
            mickey.hitDuration = 0;
            // Play a random Mickey noise
            const noiseKey = `mickeyNoise${(assets.audio.currentMickeyNoiseIndex % assets.audio.mickeyNoises.length) + 1}`;
            playSound(noiseKey);
            assets.audio.currentMickeyNoiseIndex++;
        }

        // Trigger punch effect visual
        mickey.punchEffectIndex = Math.floor(Math.random() * punchEffectImages.length);
        mickey.punchEffectDuration = 0;
    }

     function hitCrab() {
        crab.hitCount++;
        playSound('fuckCrab');

        if (crab.hitCount >= CRAB_MAX_HITS) {
            crab.state = 'dying';
            crab.deathFrame = 0;
            crab.deathAnimationDuration = 0;
            score += 3; // Points only when killed
            scoreColor = 'lightgreen'; // Flash color for crab kill
            setTimeout(() => { scoreColor = 'white'; }, 500);
        } else {
            crab.state = 'crunched'; // Show crunched state
            crab.crunchDuration = 0;
            // No score for just crunching it
            // Optional: Add slight knockback
            crab.x += 20 * gameSpeed;
        }
    }

    // --- Respawn Logic ---
    function respawnMickey() {
        mickey.x = canvas.width + Math.random() * 200; // Respawn slightly off-screen right, with variation
        mickey.visible = true;
        mickey.state = 'walking';
        mickey.baseSpeed += 0.1; // Mickey gets slightly faster each time
        mickeyHitCount = 0;
        mickey.frameX = 0;
        mickey.deathAnimationDuration = 0;
        mickey.hitDuration = 0;
        mickey.punchEffectIndex = -1; // Ensure effect is off
    }

    function respawnCrab() {
        crab.x = canvas.width + Math.random() * 300; // Respawn further off-screen
        crab.y = canvas.height - GROUND_HEIGHT - CRAB_Y_OFFSET; // Ensure correct height
        crab.visible = true;
        crab.state = 'walking';
        crab.hitCount = 0;
        crab.frameX = 0;
        crab.deathAnimationDuration = 0;
        crab.crunchDuration = 0;
        crabTimer = 0; // Reset timer only when respawning
         // Optionally increase crab speed over time?
        // crab.baseSpeed += 0.05;
    }

    // --- Draw Functions ---
    function drawBackground() {
        // Clouds (draw first, further away)
        ctx.drawImage(assets.images.cloudBackground, cloudBackgroundX, 0, canvas.width, canvas.height);
        ctx.drawImage(assets.images.cloudBackground, cloudBackgroundX + canvas.width, 0, canvas.width, canvas.height);
        // Ocean
        ctx.drawImage(assets.images.oceanBackground, oceanBackgroundX, 0, canvas.width, canvas.height);
        ctx.drawImage(assets.images.oceanBackground, oceanBackgroundX + canvas.width, 0, canvas.width, canvas.height);

        // Optional: Draw a simple ground line if needed for visual debugging
        // ctx.fillStyle = 'sandybrown';
        // ctx.fillRect(0, canvas.height - GROUND_HEIGHT, canvas.width, GROUND_HEIGHT);
    }

    function drawEric() {
        let currentImage = eric.walkImages[eric.frameX]; // Default to walking

        switch(eric.state) {
            case 'punching':
                currentImage = eric.currentPunchImage;
                break;
            case 'crunching':
                currentImage = eric.crunchImage;
                break;
            case 'pinched':
                currentImage = eric.pinchedImage;
                break;
            case 'walking':
            default:
                 // walking image already set
                 if (!currentImage) currentImage = eric.walkImages[0]; // Fallback if array empty
                 break;
        }

        if (currentImage) {
            ctx.drawImage(currentImage, eric.x, eric.y, eric.width, eric.height);
        }

        // --- DEBUG: Draw Hitboxes ---
        // ctx.strokeStyle = 'red';
        // if (eric.state === 'punching') {
        //     ctx.strokeRect(eric.x + eric.punchHitboxOffset, eric.y, eric.punchHitboxWidth, eric.height);
        // }
        // if (eric.state === 'crunching') {
        //      const crunchHitboxY = eric.y + eric.height * 0.7;
        //      const crunchHitboxHeight = eric.height * 0.3;
        //     ctx.strokeRect(eric.x + eric.crunchHitboxOffset, crunchHitboxY, eric.crunchHitboxWidth, crunchHitboxHeight);
        // }
        // ctx.strokeStyle = 'blue'; // Eric's approximate body position for ref
        // ctx.strokeRect(eric.x + 300, eric.y, 200, eric.height);
        // --- END DEBUG ---
    }

    function drawMickey() {
        if (!mickey.visible) return;

        let currentImage = null;
        switch (mickey.state) {
            case 'walking':
                currentImage = mickey.walkImages[mickey.frameX];
                break;
            case 'hit':
                currentImage = mickey.hitImage;
                break;
            case 'dying':
                currentImage = mickey.dieImages[mickey.deathFrame];
                break;
        }

        if (currentImage) {
             ctx.drawImage(currentImage, mickey.x, mickey.y, mickey.width, mickey.height);
        }


        // Draw punch effect on top
        if (mickey.punchEffectIndex !== -1) {
             const effectImage = punchEffectImages[mickey.punchEffectIndex];
             if (effectImage) {
                // Center the effect on Mickey's hitbox area
                 const effectX = mickey.x + mickey.hitboxOffset + (mickey.hitboxWidth / 2) - 100; // center effect
                 const effectY = mickey.y + mickey.height / 2 - 100; // center effect
                 ctx.drawImage(effectImage, effectX, effectY, 200, 200); // Effect size
             }
        }

         // --- DEBUG: Draw Hitbox ---
        // ctx.strokeStyle = 'lime';
        // ctx.strokeRect(mickey.x + mickey.hitboxOffset, mickey.y, mickey.hitboxWidth, mickey.height);
        // --- END DEBUG ---
    }

     function drawCrab() {
        if (!crab.visible) return;

        let currentImage = null;
        switch (crab.state) {
            case 'walking':
                currentImage = crab.walkImages[crab.frameX];
                break;
            case 'crunched':
                currentImage = crab.crunchImage;
                break;
            case 'dying':
                currentImage = crab.dieImages[crab.deathFrame];
                break;
        }

         if (currentImage) {
             ctx.drawImage(currentImage, crab.x, crab.y, crab.width, crab.height);
         }

         // --- DEBUG: Draw Hitbox ---
        // ctx.strokeStyle = 'yellow';
        // const crabHitboxX = crab.x + crab.width * 0.2;
        // const crabHitboxWidth = crab.width * 0.6;
        // const crabHitboxY = crab.y;
        // const crabHitboxHeight = crab.height * 0.5;
        // ctx.strokeRect(crabHitboxX, crabHitboxY, crabHitboxWidth, crabHitboxHeight);
        // --- END DEBUG ---
    }

    function drawScore() {
        const scoreText = `Score: ${score}`;
        const textWidth = ctx.measureText(scoreText).width;
        const padding = 10;
        const boxWidth = textWidth + padding * 2;
        const boxHeight = 30;
        const boxX = canvas.width - boxWidth - 15; // Position from right edge
        const boxY = 10;
        const textX = boxX + padding;
        const textY = boxY + boxHeight / 2 + 7; // Adjust for vertical centering

        // Draw background box
        ctx.fillStyle = 'rgba(30, 144, 255, 0.7)'; // Semi-transparent blue
        ctx.fillRect(boxX, boxY, boxWidth, boxHeight);

        // Draw score text
        ctx.fillStyle = scoreColor; // Use the dynamic score color
        ctx.font = '20px Arial';
        ctx.fillText(scoreText, textX, textY);
    }

    function drawInstructions() {
        if (showInstructions) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.6)'; // Semi-transparent black background
            ctx.fillRect(canvas.width / 2 - 210, 20, 420, 70); // Centered box

            ctx.fillStyle = 'white';
            ctx.font = 'bold 22px Arial';
            ctx.textAlign = 'center'; // Center text
            ctx.fillText('Punch Shark: [SPACE]', canvas.width / 2, 50);
            ctx.fillText('Kill Crab: [DOWN ARROW]', canvas.width / 2, 80);
            ctx.textAlign = 'left'; // Reset alignment
        }
    }

    function drawBonus() {
        if (showBonus && assets.images.bonus) {
            ctx.drawImage(assets.images.bonus, canvas.width / 2 - 100, canvas.height / 2 - 100, 200, 200);
            bonusTimer--;
            if (bonusTimer <= 0) {
                showBonus = false;
            }
        }
    }

    // --- Event Listeners ---
    function handleKeyDown(event) {
        // Start music on first interaction if needed
         if (!gameRunning && assets.audio.gameMusic) {
            startGameMusic(); // Attempt to start music and game
         }

        if (!gameRunning) return; // Don't process game actions if not running

        // Use event.code for layout independence
        switch (event.code) {
            case 'Space':
                if (eric.state === 'walking') { // Can only punch if walking
                    eric.state = 'punching';
                    eric.actionDuration = 0;
                    // Choose a random punch image
                    eric.currentPunchImage = eric.punchImages[Math.floor(Math.random() * eric.punchImages.length)];
                    // Play punch sound only when initiating the action, not on hit connect
                    // playSound('punch'); // Moved sound to hitMickey for better feedback
                }
                break;
            case 'ArrowDown':
                 if (eric.state === 'walking') { // Can only crunch if walking
                    eric.state = 'crunching';
                    eric.actionDuration = 0;
                     // No sound needed on initiating crunch, maybe on hitCrab? (already there)
                }
                break;
        }
    }

    document.addEventListener('keydown', handleKeyDown);

    // Add listener for user interaction to start music if autoplay fails
     function userInteractionStart() {
         if (!gameRunning && assets.audio.gameMusic) {
             console.log("User interaction detected, attempting to start music/game.");
             startGameMusic();
         }
         // Remove listener after first interaction
         document.removeEventListener('click', userInteractionStart);
         document.removeEventListener('keydown', userInteractionStart);
     }
     document.addEventListener('click', userInteractionStart, { once: true });
     // Also listen for keydown as an interaction starter
     document.addEventListener('keydown', userInteractionStart, { once: true });


    // --- Game Initialization ---
    function startGameMusic() {
        const music = assets.audio.gameMusic;
        if (music && music.paused) {
            music.play().then(() => {
                console.log("Game music started successfully.");
                if (!gameRunning) {
                     startGame(); // Start the game loop only after music starts (or fails gracefully)
                }
            }).catch(e => {
                console.error("Error playing game music:", e);
                // Game might still start even if music fails, depending on desired behavior
                 if (!gameRunning) {
                    console.warn("Starting game without music due to playback error.");
                    startGame();
                 }
            });
        } else if (!gameRunning) {
             // If music is already playing or not available, just start the game
             startGame();
        }
    }

     function startGame() {
         if (gameRunning) return; // Prevent multiple starts
         console.log("Starting game loop...");
         gameStartTime = Date.now();
         gameRunning = true;
         gameLoop(); // Start the actual game loop
     }

    // --- Load assets and then start ---
    console.log("Loading assets...");
    loadGameAssets()
        .then(() => {
            console.log("All assets loaded.");
            assignAssets();
            console.log("Assets assigned. Ready to start game on user interaction or autoplay.");
            // Try starting music immediately (might be blocked by browser)
            // startGameMusic(); // Moved initiation to user interaction or keydown
        })
        .catch(error => {
            console.error("Fatal error during asset loading:", error);
            // Display an error message to the user on the page?
             ctx.fillStyle = 'red';
             ctx.font = '20px Arial';
             ctx.textAlign = 'center';
             ctx.fillText('Error loading game assets. Please refresh.', canvas.width / 2, canvas.height / 2);
        });

    console.log("Game script finished initial setup.");
}); // End DOMContentLoaded
