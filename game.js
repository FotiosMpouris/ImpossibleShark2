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
    const PLAYER_Y_OFFSET = 400;
    const ENEMY_Y_OFFSET = 400;
    const CRAB_Y_OFFSET = 300;
    const MICKEY_MAX_HITS = 6;
    const CRAB_MAX_HITS = 2;
    const PUNCH_ACTIVE_START_FRAME = 5; // When punch hitbox becomes active
    const PUNCH_ACTIVE_END_FRAME = 20; // When punch hitbox deactivates
    const CRUNCH_ACTIVE_START_FRAME = 5;
    const CRUNCH_ACTIVE_END_FRAME = 20;
    const ACTION_DURATION_FRAMES = 28; // Slightly shorter action times for snappier feel
    const HIT_STAGGER_FRAMES = 25;
    const DEATH_ANIMATION_FRAMES = 60;
    const BONUS_DISPLAY_FRAMES = 60;
    const INITIAL_CRAB_SPAWN_INTERVAL = 1100; // Slightly faster crab spawns
    const GAME_SPEED_INCREASE = 0.00035; // Slightly faster ramp-up
    const INSTRUCTION_DISPLAY_DURATION_MS = 7000; // 7 seconds

    // --- NEW Feature Constants ---
    const SHAKE_INTENSITY_HIT = 3;
    const SHAKE_INTENSITY_KILL = 6;
    const SHAKE_INTENSITY_PINCH = 8;
    const SHAKE_DURATION_HIT = 8; // Frames
    const SHAKE_DURATION_KILL = 15;
    const SHAKE_DURATION_PINCH = 20;
    const HIT_STOP_FRAMES_HIT = 2; // Frames to pause on normal hit
    const HIT_STOP_FRAMES_KILL = 5; // Frames to pause on kill
    const COMBO_MAX_TIMER = 120; // Frames (2 seconds at 60fps) to continue combo
    const FLOATING_TEXT_DURATION = 70; // Frames
    const FLOATING_TEXT_SPEED = 1.5; // Pixels per frame upward movement

    // --- Game State Variables ---
    let gameSpeed = 1;
    let score = 0;
    let frameCount = 0;
    let gameStartTime = Date.now();
    let mickeyHitCount = 0;
    let scoreColor = 'white';
    let showInstructions = true;
    let crabTimer = 0;
    let showBonus = false;
    let bonusTimer = 0;
    let gameRunning = false;
    let isPaused = false; // For potential future pause feature

    // --- NEW Feature Variables ---
    let shakeIntensity = 0;
    let shakeDuration = 0;
    let hitStopTimer = 0;
    let comboCount = 0;
    let comboTimer = 0;
    let floatingTexts = []; // Array to hold { text, x, y, color, alpha, timer }

    // --- Utility Functions ---
    const getCrabSpawnInterval = () => Math.floor(INITIAL_CRAB_SPAWN_INTERVAL / gameSpeed);

    // --- Asset Loading (Keep structure from previous refactor) ---
    const assets = { images: {}, audio: {} };
    // loadImage, loadAudio functions (assuming they exist as before)
    // --- (Include the loadImage and loadAudio functions from the previous refactor here) ---
    function loadImage(key, src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        console.log(`loadImage: Creating Image for key: ${key}, src: ${src}`); // Log creation
        // DO NOT assign here: assets.images[key] = img; // Assign only on successful load
        img.onload = () => {
            console.log(`++++++ Image loaded successfully: ${key} (${src}), naturalWidth: ${img.naturalWidth}`); // Log success + size check
            assets.images[key] = img; // Assign on load success
            resolve(img);
        };
        img.onerror = (e) => { // Add event argument
            console.error(`------ FAILED to load image: ${key} (${src})`, e); // Log failure
            // Option 1: Reject (stops everything via Promise.all catch) - Good for debugging
             reject(`Failed to load image: ${key} (${src})`);
            // Option 2: Resolve anyway (game continues without image) - Might hide errors
            // resolve(null); // Or resolve with a placeholder/null
        };
        img.src = src;
    });
}
    function loadAudio(key, src, loop = false) { /* ... from previous */ }

    // --- Background ---
    let oceanBackgroundX = 0;
    let cloudBackgroundX = 0;
    let distantBackgroundX = 0; // NEW parallax layer

    // --- Eric (Player) ---
    const eric = {
        x: PLAYER_START_X,
        y: canvas.height - GROUND_HEIGHT - PLAYER_Y_OFFSET,
        width: 900,
        height: 500,
        frameX: 0,
        animationFrame: 0,
        animationDelay: 14, // Slightly faster animation
        state: 'walking', // walking, punching, punchingLeft, crunching, pinched
        actionDuration: 0,
        facingRight: true, // To handle sprite flipping for left punch
        // Hitboxes
        punchHitboxWidth: 110, // Slightly wider punch
        punchHitboxOffset: 690, // Adjust position slightly
        punchLeftHitboxWidth: 110,
        punchLeftHitboxOffset: 100, // Hitbox position for left punch (relative to eric.x)
        crunchHitboxWidth: 100,
        crunchHitboxOffset: 700,
        // Images
        walkImages: [], punchImages: [], crunchImage: null, pinchedImage: null, currentPunchImage: null
    };

    // --- Mickey (Enemy 1) ---
    const mickey = {
        // ... (mostly same as before)
        x: canvas.width,
        y: canvas.height - GROUND_HEIGHT - ENEMY_Y_OFFSET,
        width: 900, height: 500, frameX: 0, animationFrame: 0, animationDelay: 5,
        baseSpeed: 2.1, // Slightly faster base
        speed: 2.1, visible: true, state: 'walking', // walking, hit, dying
        hitDuration: 0, deathFrame: 0, deathAnimationDuration: 0,
        hitboxWidth: 100, hitboxOffset: 400,
        walkImages: [], hitImage: null, dieImages: [],
        punchEffectIndex: -1, punchEffectDuration: 0
    };

    // --- Crab (Enemy 2) ---
    const crab = {
        // ... (mostly same as before)
         x: canvas.width, y: canvas.height - GROUND_HEIGHT - CRAB_Y_OFFSET,
         width: 1000, height: 500, frameX: 0, animationFrame: 0, animationDelayBase: 9, // Faster walk
         baseSpeed: 3.2, // Faster base
         speed: 3.2, visible: false, state: 'walking', // walking, crunched, dying
         hitCount: 0, deathFrame: 0, deathAnimationDuration: 0, crunchDuration: 0,
         // Hitbox adjusted in collision check
         walkImages: [], crunchImage: null, dieImages: []
    };

    // --- Punch Effects ---
    const punchEffectImages = [];

    // --- Load All Assets ---
    function loadGameAssets() {
        const imagePromises = [
            loadImage('oceanBackground', 'assets/ImpossibleLoop01.png'),
            loadImage('cloudBackground', 'assets/ImpossibleClouds01.png'),
            loadImage('distantBackground', 'assets/ImpossibleSky01.png'), // NEW LAYER
            // ... (rest of the images as before)
            loadImage('ericCrunch', 'assets/ericCrunch.png'),
            loadImage('ericPinched', 'assets/ericPinched.png'),
            loadImage('mickeyHit', 'assets/MickeyHit.png'),
            loadImage('crabCrunch', 'assets/crabCrunch.png'),
            loadImage('bonus', 'assets/Bonus.png'),
            loadImage('ericPunch1', 'assets/ericPunch.png'),
            loadImage('ericPunch2', 'assets/ericPunch2.png'),
        ];
        // Eric Walk, Mickey Walk/Die, Crab Walk/Die, Punch Effects (loops as before)
        for (let i = 1; i <= 8; i++) imagePromises.push(loadImage(`ericRun${i}`, `assets/EricRun${i}.png`));
        for (let i = 1; i <= 21; i++) imagePromises.push(loadImage(`mickeyWalk${i}`, `assets/MickeyWalk${i.toString().padStart(2, '0')}.png`));
        for (let i = 1; i <= 3; i++) imagePromises.push(loadImage(`mickeyDie${i}`, `assets/MickeyDie${i}.png`));
        for (let i = 1; i <= 5; i++) imagePromises.push(loadImage(`crabWalk${i}`, `assets/crabWalk${i}.png`));
        for (let i = 1; i <= 3; i++) imagePromises.push(loadImage(`crabDead${i}`, `assets/crabDead${i}.png`));
        for (let i = 1; i <= 3; i++) imagePromises.push(loadImage(`punchEffect${i}`, `assets/PunchEffect${i}.png`));

        const audioPromises = [
            // ... (rest of the audio as before)
            loadAudio('punch', 'assets/PunchSound.mp3'),
            loadAudio('punchLeft', 'assets/PunchSound.mp3'), // Could use a different sound
            loadAudio('fuckCrab', 'assets/fuckCrab.mp3'),
            loadAudio('ericOuch', 'assets/ericOuch.mp3'),
            loadAudio('mickeyDeath', 'assets/deathSound.mp3'),
            loadAudio('bonus', 'assets/bonusSound.mp3'),
            loadAudio('gameMusic', 'assets/GameMusic.mp3', true)
        ];
        for (let i = 1; i <= 7; i++) audioPromises.push(loadAudio(`mickeyNoise${i}`, `assets/MickeyNoise${i}.mp3`));

        return Promise.all([...imagePromises, ...audioPromises]);
    }

    // --- Assign Loaded Assets ---
    function assignAssets() {
        // ... (assign assets as before, including the new ones if needed)
        // Assign Eric
        for (let i = 1; i <= 8; i++) eric.walkImages.push(assets.images[`ericRun${i}`]);
        eric.punchImages.push(assets.images['ericPunch1']);
        eric.punchImages.push(assets.images['ericPunch2']);
        eric.crunchImage = assets.images['ericCrunch'];
        eric.pinchedImage = assets.images['ericPinched'];
        // Assign Mickey
        for (let i = 1; i <= 21; i++) mickey.walkImages.push(assets.images[`mickeyWalk${i}`]);
        mickey.hitImage = assets.images['mickeyHit'];
        for (let i = 1; i <= 3; i++) mickey.dieImages.push(assets.images[`mickeyDie${i}`]);
        // Assign Crab
        for (let i = 1; i <= 5; i++) crab.walkImages.push(assets.images[`crabWalk${i}`]);
        crab.crunchImage = assets.images['crabCrunch'];
        for (let i = 1; i <= 3; i++) crab.dieImages.push(assets.images[`crabDead${i}`]);
        // Assign Punch Effects
        for (let i = 1; i <= 3; i++) punchEffectImages.push(assets.images[`punchEffect${i}`]);
        // Assign Sounds
        assets.audio.mickeyNoises = [];
        for (let i = 1; i <= 7; i++) assets.audio.mickeyNoises.push(assets.audio[`mickeyNoise${i}`]);
        assets.audio.currentMickeyNoiseIndex = 0;
    }

    // --- Sound Playback Helper ---
    function playSound(key) { /* ... same as before ... */ }


    // --- Game Loop ---
    function gameLoop() {
        if (!gameRunning || isPaused) { // Check pause flag
             if (gameRunning) requestAnimationFrame(gameLoop); // Keep loop going if paused for unpause
            return;
        }

        // --- Hit Stop Check ---
        if (hitStopTimer > 0) {
            hitStopTimer--;
            // Only draw, skip updates
            drawGame();
            requestAnimationFrame(gameLoop);
            return; // Skip update logic during hit stop
        }

        // --- Updates ---
        updateBackground();
        updateEric();
        updateMickey();
        updateCrab();
        updateGameSpeedAndScore(); // Contains frameCount++, combo timer
        updateFloatingTexts(); // NEW

        // --- Drawing ---
        drawGame(); // Encapsulate all drawing

        requestAnimationFrame(gameLoop);
    }

    // --- Encapsulated Drawing Function ---
    function drawGame() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // --- Apply Screen Shake ---
        let shakeOffsetX = 0;
        let shakeOffsetY = 0;
        if (shakeDuration > 0) {
            shakeDuration--;
            shakeOffsetX = (Math.random() - 0.5) * 2 * shakeIntensity;
            shakeOffsetY = (Math.random() - 0.5) * 2 * shakeIntensity;
            ctx.save();
            ctx.translate(shakeOffsetX, shakeOffsetY);
        }

        // --- Draw Layers ---
        drawBackground();
        drawCrab();
        drawMickey();
        drawEric();
        drawFloatingTexts(); // NEW
        drawScoreAndCombo(); // Combined score and combo display
        drawInstructions();
        if (showBonus) drawBonus();

        // --- Restore context after shake ---
        if (shakeOffsetX !== 0 || shakeOffsetY !== 0) {
            ctx.restore();
        }
    }

    // --- Update Functions ---
    function updateGameSpeedAndScore() {
        gameSpeed += GAME_SPEED_INCREASE;
        frameCount++;

        if (showInstructions && (Date.now() - gameStartTime > INSTRUCTION_DISPLAY_DURATION_MS)) {
            showInstructions = false;
        }

        // --- Combo Timer Update ---
        if (comboTimer > 0) {
            comboTimer--;
            if (comboTimer === 0) {
                comboCount = 0; // Reset combo when timer runs out
            }
        }
    }

    function updateBackground() {
        // NEW: Distant Background (slowest)
        distantBackgroundX -= gameSpeed * 0.1;
        if (distantBackgroundX <= -canvas.width) distantBackgroundX += canvas.width;

        // Clouds (medium)
        cloudBackgroundX -= gameSpeed * 0.4; // Adjusted speed slightly
        if (cloudBackgroundX <= -canvas.width) cloudBackgroundX += canvas.width;

        // Ocean (fastest)
        oceanBackgroundX -= gameSpeed * 1.0;
        if (oceanBackgroundX <= -canvas.width) oceanBackgroundX += canvas.width;
    }

    function updateEric() {
        // State Transitions
        if (eric.state !== 'walking') {
            eric.actionDuration++;
            if (eric.actionDuration > ACTION_DURATION_FRAMES) {
                eric.state = 'walking';
                eric.actionDuration = 0;
                eric.facingRight = true; // Reset facing direction
            }
        } else {
             eric.facingRight = true; // Ensure facing right when walking
        }

        // Animation
        if (eric.state === 'walking') {
            eric.animationFrame++;
            if (eric.animationFrame >= eric.animationDelay) {
                eric.frameX = (eric.frameX + 1) % eric.walkImages.length;
                eric.animationFrame = 0;
            }
        }
    }

    function updateMickey() {
        if (!mickey.visible) return;
        mickey.speed = mickey.baseSpeed * gameSpeed;

        switch (mickey.state) {
            case 'walking':
                mickey.x -= mickey.speed;
                mickey.animationFrame++;
                if (mickey.animationFrame >= mickey.animationDelay) {
                    mickey.frameX = (mickey.frameX + 1) % mickey.walkImages.length;
                    mickey.animationFrame = 0;
                }
                if (mickey.x + mickey.width < 0) {
                    comboCount = 0; // Reset combo if enemy passes
                    comboTimer = 0;
                    respawnMickey();
                }
                break;
            case 'hit':
                mickey.hitDuration++;
                if (mickey.hitDuration <= HIT_STAGGER_FRAMES) {
                    mickey.x += mickey.speed * 0.3; // Less knockback
                }
                if (mickey.hitDuration > ACTION_DURATION_FRAMES) { // Recover based on action duration
                    mickey.state = 'walking';
                    mickey.hitDuration = 0;
                }
                break;
            case 'dying':
                mickey.deathAnimationDuration++;
                const deathFrameDelay = DEATH_ANIMATION_FRAMES / mickey.dieImages.length;
                mickey.deathFrame = Math.min(Math.floor(mickey.deathAnimationDuration / deathFrameDelay), mickey.dieImages.length - 1);
                if (mickey.deathAnimationDuration > DEATH_ANIMATION_FRAMES) {
                    respawnMickey();
                }
                break;
        }
        // Punch Effect
        if (mickey.punchEffectIndex !== -1) {
            mickey.punchEffectDuration++;
            if (mickey.punchEffectDuration > ACTION_DURATION_FRAMES / 2) {
                mickey.punchEffectIndex = -1;
                mickey.punchEffectDuration = 0;
            }
        }
        checkEricPunchCollision();
    }

    function updateCrab() {
         if (crab.visible) {
            crab.speed = crab.baseSpeed * gameSpeed;
            const currentAnimationDelay = Math.max(1, Math.floor(crab.animationDelayBase / gameSpeed));

            switch (crab.state) {
                case 'walking':
                    crab.x -= crab.speed;
                    crab.animationFrame++;
                    if (crab.animationFrame >= currentAnimationDelay) {
                        crab.frameX = (crab.frameX + 1) % crab.walkImages.length;
                        crab.animationFrame = 0;
                    }
                    // Pinch Check (more forgiving - check middle of Eric)
                    if (crab.x + crab.width * 0.7 < eric.x + eric.width * 0.5) { // Crab claws past Eric's center
                         if (!eric.pinched && eric.state !== 'pinched') {
                            crabPassed();
                        }
                    }
                     if (crab.x + crab.width < 0) { // Fully off screen
                        crab.visible = false;
                        crabTimer = 0;
                        comboCount = 0; // Reset combo if crab passes
                        comboTimer = 0;
                    }
                    break;
                 case 'crunched':
                    crab.crunchDuration++;
                    // Optional slight drift back
                    crab.x += gameSpeed * 0.5;
                    if (crab.crunchDuration > ACTION_DURATION_FRAMES * 0.8) { // Shorter crunch visual
                        crab.state = 'walking';
                        crab.crunchDuration = 0;
                    }
                    break;
                case 'dying':
                    crab.deathAnimationDuration++;
                    const deathFrameDelay = DEATH_ANIMATION_FRAMES / crab.dieImages.length;
                    crab.deathFrame = Math.min(Math.floor(crab.deathAnimationDuration / deathFrameDelay), crab.dieImages.length - 1);
                    if (crab.deathAnimationDuration > DEATH_ANIMATION_FRAMES) {
                        crab.visible = false;
                        crab.hitCount = 0;
                        crabTimer = 0;
                    }
                    break;
            }
            checkEricCrunchCollision();
        } else {
            crabTimer++;
            if (crabTimer >= getCrabSpawnInterval()) {
                respawnCrab();
            }
        }
    }

    function crabPassed() {
        crab.visible = false; // Disappears immediately
        eric.state = 'pinched';
        eric.actionDuration = 0;
        score = Math.max(0, score - 5);
        playSound('ericOuch');
        triggerShake(SHAKE_INTENSITY_PINCH, SHAKE_DURATION_PINCH); // Shake on pinch
        comboCount = 0; // Reset combo on getting hit
        comboTimer = 0;
        addFloatingText("-5", eric.x + eric.width / 2, eric.y + 100, 'red');
        crabTimer = 0;
    }

    // --- NEW: Floating Text Update ---
    function updateFloatingTexts() {
        for (let i = floatingTexts.length - 1; i >= 0; i--) {
            const txt = floatingTexts[i];
            txt.timer--;
            txt.y -= FLOATING_TEXT_SPEED; // Move up
            txt.alpha = txt.timer / FLOATING_TEXT_DURATION; // Fade out

            if (txt.timer <= 0) {
                floatingTexts.splice(i, 1); // Remove expired text
            }
        }
    }

    // --- Collision Detection ---
    function checkEricPunchCollision() {
        if (!mickey.visible || mickey.state !== 'walking') return;

        let isPunching = false;
        let punchHitbox = {};

        // Check Right Punch
        if (eric.state === 'punching' &&
            eric.actionDuration >= PUNCH_ACTIVE_START_FRAME &&
            eric.actionDuration <= PUNCH_ACTIVE_END_FRAME)
        {
            isPunching = true;
            punchHitbox = {
                x: eric.x + eric.punchHitboxOffset,
                y: eric.y,
                width: eric.punchHitboxWidth,
                height: eric.height * 0.8 // Punch doesn't usually hit feet
            };
        }
        // Check Left Punch
        else if (eric.state === 'punchingLeft' &&
                 eric.actionDuration >= PUNCH_ACTIVE_START_FRAME &&
                 eric.actionDuration <= PUNCH_ACTIVE_END_FRAME)
        {
             isPunching = true;
             punchHitbox = {
                x: eric.x + eric.punchLeftHitboxOffset,
                y: eric.y,
                width: eric.punchLeftHitboxWidth,
                height: eric.height * 0.8
             };
        }

        if (isPunching) {
            const mickeyHitbox = {
                x: mickey.x + mickey.hitboxOffset,
                y: mickey.y,
                width: mickey.hitboxWidth,
                height: mickey.height
            };

            // AABB collision check
            if (punchHitbox.x < mickeyHitbox.x + mickeyHitbox.width &&
                punchHitbox.x + punchHitbox.width > mickeyHitbox.x &&
                punchHitbox.y < mickeyHitbox.y + mickeyHitbox.height &&
                punchHitbox.y + punchHitbox.height > mickeyHitbox.y)
            {
                 // Push Mickey back slightly relative to punch direction
                 if (eric.state === 'punching') {
                    mickey.x = punchHitbox.x + punchHitbox.width - mickey.hitboxOffset + 15; // Push right
                 } else { // punchingLeft
                     // No push back needed, Mickey is already moving away mostly
                 }
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
             const crunchHitbox = {
                x: eric.x + eric.crunchHitboxOffset,
                y: eric.y + eric.height * 0.65, // Crunch lower
                width: eric.crunchHitboxWidth,
                height: eric.height * 0.35
            };
            // More generous crab hitbox
            const crabHitbox = {
                x: crab.x + crab.width * 0.1,
                y: crab.y + crab.height * 0.3, // Hit lower part of crab
                width: crab.width * 0.8,
                height: crab.height * 0.7
            };

             if (crunchHitbox.x < crabHitbox.x + crabHitbox.width &&
                crunchHitbox.x + crunchHitbox.width > crabHitbox.x &&
                crunchHitbox.y < crabHitbox.y + crabHitbox.height &&
                crunchHitbox.y + crunchHitbox.height > crabHitbox.y)
             {
                hitCrab();
             }
        }
    }


    // --- Hit Handling ---
    function hitMickey() {
        mickeyHitCount++;
        let scoreToAdd = 1;
        comboCount++;
        comboTimer = COMBO_MAX_TIMER; // Reset combo timer on hit
        scoreToAdd *= Math.max(1, Math.floor(comboCount / 5)); // Score multiplier every 5 combo points

        score += scoreToAdd;
        addFloatingText(`+${scoreToAdd}`, mickey.x + mickey.hitboxOffset + mickey.hitboxWidth / 2, mickey.y + 100, 'yellow');
        playSound(eric.state === 'punchingLeft' ? 'punchLeft' : 'punch'); // Use correct punch sound

        if (mickeyHitCount >= MICKEY_MAX_HITS) {
            mickey.state = 'dying';
            mickey.deathFrame = 0;
            mickey.deathAnimationDuration = 0;
            playSound('mickeyDeath');
            triggerShake(SHAKE_INTENSITY_KILL, SHAKE_DURATION_KILL); // Stronger shake on kill
            triggerHitStop(HIT_STOP_FRAMES_KILL); // Longer hit stop on kill

            let bonusScore = 10 * Math.max(1, Math.floor(comboCount / 10)); // Bonus multiplier every 10 combo
            score += bonusScore;
            addFloatingText(`BONUS +${bonusScore}`, mickey.x + mickey.width/2, mickey.y + 50, 'gold');

            scoreColor = 'gold';
            setTimeout(() => { scoreColor = 'white'; }, 500);

            setTimeout(() => {
                playSound('bonus');
                showBonus = true;
                bonusTimer = BONUS_DISPLAY_FRAMES;
            }, 300); // Show bonus slightly faster

        } else {
            mickey.state = 'hit';
            mickey.hitDuration = 0;
            const noiseKey = `mickeyNoise${(assets.audio.currentMickeyNoiseIndex % assets.audio.mickeyNoises.length) + 1}`;
            playSound(noiseKey);
            assets.audio.currentMickeyNoiseIndex++;
            triggerShake(SHAKE_INTENSITY_HIT, SHAKE_DURATION_HIT); // Normal shake on hit
            triggerHitStop(HIT_STOP_FRAMES_HIT); // Short hit stop on hit
        }

        // Trigger punch effect visual
        mickey.punchEffectIndex = Math.floor(Math.random() * punchEffectImages.length);
        mickey.punchEffectDuration = 0;
    }

    function hitCrab() {
        crab.hitCount++;
        playSound('fuckCrab');
        triggerShake(SHAKE_INTENSITY_HIT, SHAKE_DURATION_HIT);
        triggerHitStop(HIT_STOP_FRAMES_HIT);
        comboCount++; // Crunching adds to combo too
        comboTimer = COMBO_MAX_TIMER;

        if (crab.hitCount >= CRAB_MAX_HITS) {
            crab.state = 'dying';
            crab.deathFrame = 0;
            crab.deathAnimationDuration = 0;
            let crabScore = 3 * Math.max(1, Math.floor(comboCount / 5));
            score += crabScore;
            addFloatingText(`+${crabScore}`, crab.x + crab.width / 2, crab.y + 100, 'lightgreen');
            scoreColor = 'lightgreen';
            setTimeout(() => { scoreColor = 'white'; }, 500);
            triggerShake(SHAKE_INTENSITY_KILL, SHAKE_DURATION_KILL); // Kill shake
            triggerHitStop(HIT_STOP_FRAMES_KILL); // Kill hit stop
        } else {
            crab.state = 'crunched';
            crab.crunchDuration = 0;
             addFloatingText("Crunch!", crab.x + crab.width / 2, crab.y + 100, 'orange');
            // Optional: Add slight knockback on crunch
             crab.x += 30 * gameSpeed;
        }
    }

    // --- Respawn Logic ---
    function respawnMickey() {
        // ... (same as before, maybe increase base speed slightly more?)
        mickey.x = canvas.width + Math.random() * 200;
        mickey.visible = true;
        mickey.state = 'walking';
        mickey.baseSpeed += 0.15; // Faster increase
        mickeyHitCount = 0; mickey.frameX = 0; mickey.deathAnimationDuration = 0;
        mickey.hitDuration = 0; mickey.punchEffectIndex = -1;
    }

    function respawnCrab() {
        // ... (same as before, maybe increase base speed slightly?)
        crab.x = canvas.width + Math.random() * 300;
        crab.y = canvas.height - GROUND_HEIGHT - CRAB_Y_OFFSET;
        crab.visible = true; crab.state = 'walking'; crab.hitCount = 0; crab.frameX = 0;
        crab.deathAnimationDuration = 0; crab.crunchDuration = 0; crabTimer = 0;
        crab.baseSpeed += 0.08; // Crab speed increases too
    }

    // --- Draw Functions ---
    function drawBackground() {
        // Draw layers back to front
        if (assets.images.distantBackground) { // NEW Layer
            ctx.drawImage(assets.images.distantBackground, distantBackgroundX, 0, canvas.width, canvas.height);
            ctx.drawImage(assets.images.distantBackground, distantBackgroundX + canvas.width, 0, canvas.width, canvas.height);
        }
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
        let currentImage = eric.walkImages[eric.frameX] || eric.walkImages[0]; // Fallback

        switch(eric.state) {
            case 'punching':
                currentImage = eric.currentPunchImage || eric.punchImages[0];
                break;
            case 'punchingLeft': // Use same punch images, but flip context
                currentImage = eric.currentPunchImage || eric.punchImages[0];
                break; // Actual drawing handles flip
            case 'crunching':
                currentImage = eric.crunchImage;
                break;
            case 'pinched':
                currentImage = eric.pinchedImage;
                break;
        }

        // --- Handle Sprite Flipping for Left Punch ---
        let flip = (eric.state === 'punchingLeft');
        if (flip) {
            ctx.save();
            // Translate to the pivot point (center of Eric's sprite), scale, then translate back
            ctx.translate(eric.x + eric.width / 2, 0);
            ctx.scale(-1, 1); // Flip horizontally
            ctx.translate(-(eric.x + eric.width / 2), 0);
        }

        if (currentImage) {
             // Slightly tint red when pinched
             let originalAlpha = ctx.globalAlpha;
            if (eric.state === 'pinched' && eric.actionDuration % 10 < 5) { // Flashing effect
                 ctx.globalAlpha = 0.8; // Make slightly transparent
                 // Apply a red tint - more complex, maybe skip for now or use filter
                 // ctx.filter = 'sepia(100%) saturate(300%) hue-rotate(-50deg)'; // Example filter
            }

            ctx.drawImage(currentImage, eric.x, eric.y, eric.width, eric.height);

             // Reset alpha/filter if changed
             ctx.globalAlpha = originalAlpha;
             // ctx.filter = 'none';
        }

        if (flip) {
            ctx.restore(); // Restore context after flipping
        }

        // DEBUG Hitboxes (Add cases for left punch)
        // ctx.strokeStyle = 'red';
        // if (eric.state === 'punching') ctx.strokeRect(eric.x + eric.punchHitboxOffset, eric.y, eric.punchHitboxWidth, eric.height * 0.8);
        // if (eric.state === 'punchingLeft') ctx.strokeRect(eric.x + eric.punchLeftHitboxOffset, eric.y, eric.punchLeftHitboxWidth, eric.height * 0.8);
        // // ... crunch hitbox ...
    }

    function drawMickey() { /* ... mostly same as before ... */ }
    function drawCrab() { /* ... mostly same as before ... */ }

    // --- NEW: Draw Floating Text ---
    function drawFloatingTexts() {
        ctx.save();
        ctx.font = 'bold 20px Arial';
        ctx.textAlign = 'center';
        floatingTexts.forEach(txt => {
            ctx.globalAlpha = txt.alpha;
            ctx.fillStyle = txt.color;
            ctx.fillText(txt.text, txt.x, txt.y);
        });
        ctx.restore();
    }

    function drawScoreAndCombo() { // Renamed and updated
        const scoreText = `Score: ${score}`;
        const padding = 10;
        const boxHeight = 30;
        const scoreY = 10;

        // Score Box
        ctx.font = '20px Arial';
        const scoreWidth = ctx.measureText(scoreText).width;
        const scoreBoxWidth = scoreWidth + padding * 2;
        const scoreBoxX = canvas.width - scoreBoxWidth - 15;
        const scoreTextX = scoreBoxX + padding;
        const scoreTextY = scoreY + boxHeight / 2 + 7;

        ctx.fillStyle = 'rgba(30, 144, 255, 0.7)';
        ctx.fillRect(scoreBoxX, scoreY, scoreBoxWidth, boxHeight);
        ctx.fillStyle = scoreColor;
        ctx.fillText(scoreText, scoreTextX, scoreTextY);

        // Combo Box (only show if combo > 1)
        if (comboCount > 1) {
            const comboText = `Combo: ${comboCount}x`;
            ctx.font = 'bold 18px Arial'; // Slightly smaller bold font for combo
            const comboWidth = ctx.measureText(comboText).width;
            const comboHeight = 25;
            const comboY = scoreY + boxHeight + 5; // Position below score box
            const comboPadding = 8;
            const comboColor = `hsl(${Math.min(120, comboCount * 5)}, 100%, 60%)`; // Color changes with combo count (Green to Yellow to Reddish)
            const comboAlpha = 0.6 + (comboTimer / COMBO_MAX_TIMER) * 0.4; // Fade out slightly as timer runs down

            const comboBoxWidth = comboWidth + comboPadding * 2;
            const comboBoxX = canvas.width - comboBoxWidth - 15; // Align with score box right edge
            const comboTextX = comboBoxX + comboPadding;
            const comboTextY = comboY + comboHeight / 2 + 6;

            ctx.fillStyle = `rgba(0, 0, 0, ${comboAlpha * 0.8})`; // Semi-transparent black background
            ctx.fillRect(comboBoxX, comboY, comboBoxWidth, comboHeight);
            ctx.fillStyle = comboColor;
            ctx.globalAlpha = comboAlpha;
            ctx.fillText(comboText, comboTextX, comboTextY);
            ctx.globalAlpha = 1.0; // Reset alpha
        }
    }

    function drawInstructions() {
        if (showInstructions) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
            ctx.fillRect(canvas.width / 2 - 250, 20, 500, 90); // Slightly larger box

            ctx.fillStyle = 'white';
            ctx.font = 'bold 20px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('Punch Right: [SPACE]', canvas.width / 2, 50);
            ctx.fillText('Punch Left: [A] or [LEFT ARROW]', canvas.width / 2, 75); // NEW Control
            ctx.fillText('Kill Crab: [S] or [DOWN ARROW]', canvas.width / 2, 100); // NEW Control Alt
            ctx.textAlign = 'left';
        }
    }

    function drawBonus() { /* ... same as before ... */ }

    // --- Event Listeners ---
    function handleKeyDown(event) {
         if (!gameRunning && assets.audio.gameMusic) startGameMusic();
         if (!gameRunning || isPaused) return;

        // Prevent default browser action for arrow keys and space
        if (['Space', 'ArrowDown', 'ArrowLeft', 'KeyA', 'KeyS'].includes(event.code)) {
            event.preventDefault();
        }

        if (eric.state === 'walking') { // Can only act if walking
            switch (event.code) {
                case 'Space':
                    eric.state = 'punching';
                    eric.actionDuration = 0;
                    eric.currentPunchImage = eric.punchImages[Math.floor(Math.random() * eric.punchImages.length)];
                    // playSound('punch'); // Sound moved to hit connect
                    break;
                case 'KeyA': // NEW Punch Left
                case 'ArrowLeft': // NEW Punch Left Alt
                     eric.state = 'punchingLeft';
                     eric.facingRight = false; // Set facing direction
                     eric.actionDuration = 0;
                     eric.currentPunchImage = eric.punchImages[Math.floor(Math.random() * eric.punchImages.length)];
                     // playSound('punchLeft'); // Sound moved to hit connect
                    break;
                case 'KeyS': // NEW Crunch Alt
                case 'ArrowDown':
                    eric.state = 'crunching';
                    eric.actionDuration = 0;
                    break;
            }
        }
    }
    document.addEventListener('keydown', handleKeyDown);
    // User Interaction Start Listener (same as before)
    function userInteractionStart() { /* ... same as before ... */ }
    document.addEventListener('click', userInteractionStart, { once: true });
    document.addEventListener('keydown', userInteractionStart, { once: true });

    // --- Game Initialization & Start ---
    function startGameMusic() { /* ... same as before ... */ }
    function startGame() { /* ... same as before ... */ }

    // --- NEW Utility Functions ---
    function triggerShake(intensity, duration) {
        // Prioritize stronger shakes
        if (intensity >= shakeIntensity) {
            shakeIntensity = intensity;
            shakeDuration = duration;
        } else if (shakeDuration <= 0) { // Only apply weaker shake if not already shaking
            shakeIntensity = intensity;
            shakeDuration = duration;
        }
    }

    function triggerHitStop(duration) {
        // Don't override a longer hit stop with a shorter one
        hitStopTimer = Math.max(hitStopTimer, duration);
    }

    function addFloatingText(text, x, y, color = 'white') {
        floatingTexts.push({
            text: text,
            x: x,
            y: y,
            color: color,
            alpha: 1,
            timer: FLOATING_TEXT_DURATION
        });
        // Limit max floating texts to avoid clutter/performance issues
        if (floatingTexts.length > 20) {
            floatingTexts.shift(); // Remove the oldest one
        }
    }

    // --- Load assets and then start ---
    console.log("Loading assets...");
    loadGameAssets()
        .then(() => {
            console.log("All assets loaded.");
            assignAssets();
            // Find the new background image if it exists
            if (!assets.images.distantBackground) {
                console.warn("Distant background image not loaded/found. Skipping enhanced parallax.");
            }
            console.log("Assets assigned. Ready to start game on user interaction or autoplay.");
        })
        .catch(error => { /* ... error handling as before ... */ });

    console.log("Game script finished initial setup.");
}); // End DOMContentLoaded
