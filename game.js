console.log("Game script started");

document.addEventListener('DOMContentLoaded', function() {
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');

    // Game variables
    let gameSpeed = 1;
    const GROUND_HEIGHT = 100;
    let score = 0;
    let frameCount = 0;
    let gameStartTime = Date.now();
    const MICKEY_MAX_HITS = 6;
    let mickeyHitCount = 0;
    let scoreColor = 'black';
    let showInstructions = true;
    let crabTimer = 0;
    const getCrabSpawnInterval = () => Math.floor(1200 / gameSpeed);

    // Background images
    const oceanBackground = new Image();
    oceanBackground.src = 'assets/ImpossibleLoop01.png';
    let oceanBackgroundX = 0;

    const cloudBackground = new Image();
    cloudBackground.src = 'assets/ImpossibleClouds01.png';
    let cloudBackgroundX = 0;

    // Eric character
    const eric = {
        x: -300,
        y: canvas.height - GROUND_HEIGHT - 400,
        width: 900,
        height: 500,
        frameX: 0,
        frameY: 0,
        speed: 9,
        walking: true,
        punching: false,
        punchDuration: 0,
        punchHitboxWidth: 100,
        punchHitboxOffset: 700,
        pinched: false,
        pinchedDuration: 0,
        crunching: false,
        crunchDuration: 0,
        crunchHitboxWidth: 100,
        crunchHitboxOffset: 700
    };

    // Eric's walking animation
    const ericImages = [];
    for (let i = 1; i <= 8; i++) {
        const img = new Image();
        img.src = `assets/EricRun${i}.png`;
        ericImages.push(img);
    }

    // Eric's punch images
    const ericPunchImage1 = new Image();
    ericPunchImage1.src = 'assets/ericPunch.png';
    const ericPunchImage2 = new Image();
    ericPunchImage2.src = 'assets/ericPunch2.png';
    let currentPunchImage = ericPunchImage1;

    // Eric's crunch image
    const ericCrunchImage = new Image();
    ericCrunchImage.src = 'assets/ericCrunch.png';

    // Eric pinched image
    const ericPinchedImage = new Image();
    ericPinchedImage.src = 'assets/ericPinched.png';

    // Punch effect animations
    const punchEffects = [];
    for (let i = 1; i <= 3; i++) {
        const img = new Image();
        img.src = `assets/PunchEffect${i}.png`;
        punchEffects.push(img);
    }

    // Mickey character
    const mickey = {
        x: canvas.width,
        y: canvas.height - GROUND_HEIGHT - 400,
        width: 900,
        height: 500,
        frameX: 0,
        speed: 2,
        visible: true,
        state: 'walking',
        hitDuration: 0,
        staggerDistance: 50,
        hitboxWidth: 100,
        hitboxOffset: 400,
        deathFrame: 0,
        deathAnimationDuration: 0,
        punchEffectIndex: -1,
        punchEffectDuration: 0
    };

    // Mickey's walking animation
    const mickeyImages = [];
    for (let i = 1; i <= 21; i++) {
        const img = new Image();
        img.src = `assets/MickeyWalk${i.toString().padStart(2, '0')}.png`;
        mickeyImages.push(img);
    }

    // Mickey's hit image
    const mickeyHitImage = new Image();
    mickeyHitImage.src = 'assets/MickeyHit.png';

    // Mickey's death animation
    const mickeyDieImages = [];
    for (let i = 1; i <= 3; i++) {
        const img = new Image();
        img.src = `assets/MickeyDie${i}.png`;
        mickeyDieImages.push(img);
    }

    // Crab character
    const crab = {
        x: canvas.width,
        y: canvas.height - GROUND_HEIGHT - 300,
        width: 1000,
        height: 500,
        frameX: 0,
        baseSpeed: 3,
        speed: 2,
        visible: false,
        state: 'walking',
        hitCount: 0,
        deathFrame: 0,
        deathAnimationDuration: 0,
        crunchDuration: 0
    };

    // Crab walking animation
    const crabImages = [];
    for (let i = 1; i <= 5; i++) {
        const img = new Image();
        img.src = `assets/crabWalk${i}.png`;
        crabImages.push(img);
    }

    // Crab death and crunch images
    const crabCrunchImage = new Image();
    crabCrunchImage.src = 'assets/crabCrunch.png';

    const crabDieImages = [];
    for (let i = 1; i <= 3; i++) {
        const img = new Image();
        img.src = `assets/crabDead${i}.png`;
        crabDieImages.push(img);
    }

    // Sounds
    const punchSound = new Audio('assets/PunchSound.mp3');
    const fuckCrabSound = new Audio('assets/fuckCrab.mp3');
    const mickeyNoises = [
        new Audio('assets/MickeyNoise1.mp3'),
        new Audio('assets/MickeyNoise2.mp3'),
        new Audio('assets/MickeyNoise3.mp3'),
        new Audio('assets/MickeyNoise4.mp3'),
        new Audio('assets/MickeyNoise5.mp3'),
        new Audio('assets/MickeyNoise6.mp3'),
        new Audio('assets/MickeyNoise7.mp3')
    ];
    let currentMickeyNoiseIndex = 0;

    // Eric ouch sound
    const ericOuchSound = new Audio('assets/ericOuch.mp3');

    // Game music setup
    const gameMusic = new Audio('assets/GameMusic.mp3');
    gameMusic.loop = true;
    const deathSound = new Audio('assets/deathSound.mp3');
    const bonusSound = new Audio('assets/bonusSound.mp3');

    // Bonus image
    const bonusImage = new Image();
    bonusImage.src = 'assets/Bonus.png';
    let showBonus = false;
    let bonusTimer = 0;

    // Error handling for asset loading
    function handleAssetError(asset, name) {
        console.error(`Failed to load ${name}: ${asset.src || asset.currentSrc}`);
    }

    [oceanBackground, cloudBackground, ...ericImages, ericPunchImage1, ericPunchImage2, 
     ...punchEffects, ...mickeyImages, mickeyHitImage, ...mickeyDieImages, bonusImage, 
     ericPinchedImage, ...crabImages, ericCrunchImage, crabCrunchImage, ...crabDieImages].forEach(img => {
        img.onerror = () => handleAssetError(img, 'image');
    });

    [punchSound, ...mickeyNoises, gameMusic, deathSound, bonusSound, ericOuchSound, fuckCrabSound].forEach(audio => {
        audio.onerror = () => handleAssetError(audio, 'audio');
    });

    // Function to start game music
    function startGameMusic() {
        gameMusic.play().catch(e => {
            console.error("Error playing game music:", e);
            document.addEventListener('click', () => {
                gameMusic.play().catch(e => console.error("Error playing game music after click:", e));
            }, { once: true });
        });
    }

    // Game loop
    function gameLoop() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        updateBackground();
        updateEric();
        updateMickey();
        updateCrab();

        drawBackground();
        drawEric();
        drawMickey();
        drawCrab();
        drawScore();
        drawInstructions();
        
        if (showBonus) {
            drawBonus();
        }

        gameSpeed += 0.0003;
        frameCount++;

        requestAnimationFrame(gameLoop);
    }

    // Update functions
    function updateBackground() {
        oceanBackgroundX -= gameSpeed;
        if (oceanBackgroundX <= -canvas.width) {
            oceanBackgroundX = 0;
        }

        cloudBackgroundX -= gameSpeed * 0.5;
        if (cloudBackgroundX <= -canvas.width) {
            cloudBackgroundX = 0;
        }
    }

    function updateEric() {
        if (eric.walking && !eric.punching && !eric.pinched && !eric.crunching) {
            if (frameCount % 15 === 0) {
                eric.frameX = (eric.frameX + 1) % 8;
            }
        }
        if (eric.punching) {
            eric.punchDuration++;
            if (eric.punchDuration > 30) {
                eric.punching = false;
                eric.punchDuration = 0;
            }
        }
        if (eric.crunching) {
            eric.crunchDuration++;
            if (eric.crunchDuration > 30) {
                eric.crunching = false;
                eric.crunchDuration = 0;
            }
        }
        if (eric.pinched) {
            eric.pinchedDuration++;
            if (eric.pinchedDuration > 30) {
                eric.pinched = false;
                eric.pinchedDuration = 0;
            }
        }
    }

    function updateMickey() {
        if (mickey.visible) {
            switch(mickey.state) {
                case 'walking':
                    mickey.x -= mickey.speed;
                    if (frameCount % 5 === 0) {
                        mickey.frameX = (mickey.frameX + 1) % 21;
                    }
                    if (mickey.x + mickey.hitboxOffset < eric.x) {
                        respawnMickey();
                    }
                    break;
                case 'hit':
                    mickey.hitDuration++;
                    if (mickey.hitDuration <= 30) {
                        mickey.x += mickey.speed * 0.5;
                    } else if (mickey.hitDuration > 60) {
                        mickey.state = 'walking';
                        mickey.hitDuration = 0;
                    }
                    break;
                case 'dying':
                    mickey.deathAnimationDuration++;
                    if (mickey.deathAnimationDuration % 20 === 0) {
                        mickey.deathFrame = (mickey.deathFrame + 1) % 3;
                    }
                    if (mickey.deathAnimationDuration > 60) {
                        respawnMickey();
                    }
                    break;
            }

            if (mickey.punchEffectIndex !== -1) {
                mickey.punchEffectDuration++;
                if (mickey.punchEffectDuration > 30) {
                    mickey.punchEffectIndex = -1;
                    mickey.punchEffectDuration = 0;
                }
            }

            if (eric.punching && 
                eric.punchDuration >= 5 && eric.punchDuration <= 20 && 
                mickey.state === 'walking' &&
                mickey.x + mickey.hitboxOffset < eric.x + eric.punchHitboxOffset + eric.punchHitboxWidth &&
                mickey.x + mickey.hitboxOffset + mickey.hitboxWidth > eric.x + eric.punchHitboxOffset) {
                mickey.x = eric.x + eric.punchHitboxOffset + eric.punchHitboxWidth - mickey.hitboxOffset - mickey.hitboxWidth + 50;
                hitMickey();
            }
        }
    }

    function updateCrab() {
        if (crab.visible) {
            switch(crab.state) {
                case 'walking':
                    crab.speed = crab.baseSpeed * gameSpeed;
                    crab.x -= crab.speed;
                    if (frameCount % Math.max(1, Math.floor(10 / gameSpeed)) === 0) {
                        crab.frameX = (crab.frameX + 1) % 5;
                    }
                    if (crab.x + crab.width < 0) {
                        crab.visible = false;
                        eric.pinched = true;
                        eric.pinchedDuration = 0;
                        score = Math.max(0, score - 5); // Subtract 5 points, but don't go below 0
                        ericOuchSound.play().catch(e => console.error("Error playing Eric ouch sound:", e));
                    }
                    break;
                case 'crunched':
                    crab.crunchDuration++;
                    if (crab.crunchDuration > 30) {
                        crab.state = 'walking';
                        crab.crunchDuration = 0;
                    }
                    break;
                case 'dying':
                    crab.deathAnimationDuration++;
                    if (crab.deathAnimationDuration % 20 === 0) {
                        crab.deathFrame = (crab.deathFrame + 1) % 3;
                    }
                    if (crab.deathAnimationDuration > 60) {
                        crab.visible = false;
                        crab.hitCount = 0;
                    }
                    break;
            }

            // Check for crunch collision
            if (eric.crunching && 
                eric.crunchDuration >= 5 && eric.crunchDuration <= 20 && 
                crab.state === 'walking' &&
                crab.x < eric.x + eric.crunchHitboxOffset + eric.crunchHitboxWidth &&
                crab.x + crab.width > eric.x + eric.crunchHitboxOffset) {
                hitCrab();
            }
        } else {
            crabTimer++;
            if (crabTimer >= getCrabSpawnInterval()) {
                respawnCrab();
            }
        }
    }

    function hitCrab() {
        crab.hitCount++;
        fuckCrabSound.play().catch(e => console.error("Error playing crab sound:", e));
        
        if (crab.hitCount >= 2) {
            crab.state = 'dying';
            crab.deathFrame = 0;
            crab.deathAnimationDuration = 0;
            score += 3; // Bonus points for killing crab
        } else {
            crab.state = 'crunched';
            crab.crunchDuration = 0;
            score += 1; // Points for hitting crab
        }
    }

    function respawnCrab() {
        crab.x = canvas.width;
        crab.visible = true;
        crab.state = 'walking';
        crab.hitCount = 0;
        crab.frameX = 0;
        crabTimer = 0;
    }

    function hitMickey() {
        mickeyHitCount++;
        if (mickeyHitCount >= MICKEY_MAX_HITS) {
            mickey.state = 'dying';
            mickey.deathFrame = 0;
            mickey.deathAnimationDuration = 0;
            deathSound.play().catch(e => console.error("Error playing death sound:", e));
            setTimeout(() => {
                bonusSound.play().catch(e => console.error("Error playing bonus sound:", e));
                score += 10;
                scoreColor = 'red';
                setTimeout(() => { scoreColor = 'black'; }, 1000);
                showBonus = true;
                bonusTimer = 60;
            }, 1000);
        } else {
            mickey.state = 'hit';
            mickey.hitDuration = 0;
            mickeyNoises[currentMickeyNoiseIndex].play().catch(e => console.error("Error playing Mickey noise:", e));
            currentMickeyNoiseIndex = (currentMickeyNoiseIndex + 1) % mickeyNoises.length;
        }
        mickey.punchEffectIndex = Math.floor(Math.random() * 3);
        mickey.punchEffectDuration = 0;
        score++;
    }

    function respawnMickey() {
        mickey.x = canvas.width;
        mickey.visible = true;
        mickey.state = 'walking';
        mickey.speed += 0.1;
        mickeyHitCount = 0;
        mickey.frameX = 0;
    }

    // Draw functions
    function drawBackground() {
        ctx.drawImage(cloudBackground, cloudBackgroundX, 0, canvas.width, canvas.height);
        ctx.drawImage(cloudBackground, cloudBackgroundX + canvas.width, 0, canvas.width, canvas.height);
        ctx.drawImage(oceanBackground, oceanBackgroundX, 0, canvas.width, canvas.height);
        ctx.drawImage(oceanBackground, oceanBackgroundX + canvas.width, 0, canvas.width, canvas.height);
    }

    function drawEric() {
        if (eric.pinched) {
            ctx.drawImage(ericPinchedImage, eric.x, eric.y, eric.width, eric.height);
        } else if (eric.punching) {
            ctx.drawImage(currentPunchImage, eric.x, eric.y, eric.width, eric.height);
        } else if (eric.crunching) {
            ctx.drawImage(ericCrunchImage, eric.x, eric.y, eric.width, eric.height);
        } else {
            ctx.drawImage(ericImages[eric.frameX], eric.x, eric.y, eric.width, eric.height);
        }
    }

    function drawMickey() {
        if (mickey.visible) {
            switch(mickey.state) {
                case 'walking':
                    ctx.drawImage(mickeyImages[mickey.frameX], mickey.x, mickey.y, mickey.width, mickey.height);
                    break;
                case 'hit':
                    ctx.drawImage(mickeyHitImage, mickey.x, mickey.y, mickey.width, mickey.height);
                    break;
                case 'dying':
                    ctx.drawImage(mickeyDieImages[mickey.deathFrame], mickey.x, mickey.y, mickey.width, mickey.height);
                    break;
            }

            if (mickey.punchEffectIndex !== -1) {
                ctx.drawImage(punchEffects[mickey.punchEffectIndex], 
                    mickey.x + mickey.width / 2 - 100, 
                    mickey.y + mickey.height / 2 - 100, 
                    200, 200);
            }
        }
    }

    function drawCrab() {
        if (crab.visible) {
            switch(crab.state) {
                case 'walking':
                    ctx.drawImage(crabImages[crab.frameX], crab.x, crab.y, crab.width, crab.height);
                    break;
                case 'crunched':
                    ctx.drawImage(crabCrunchImage, crab.x, crab.y, crab.width, crab.height);
                    break;
                case 'dying':
                    ctx.drawImage(crabDieImages[crab.deathFrame], crab.x, crab.y, crab.width, crab.height);
                    break;
            }
        }
    }

    function drawScore() {
        ctx.fillStyle = scoreColor;
        ctx.font = '20px Arial';
        ctx.fillText(`Score: ${score}`, 10, 30);
    }

    function drawInstructions() {
        const currentTime = Date.now();
        const elapsedTime = currentTime - gameStartTime;
        
        if (elapsedTime < 10000) { // Show for 10 seconds
            // Change state every 1 second (1000 milliseconds)
            showInstructions = Math.floor(elapsedTime / 1000) % 2 === 0;
            
            if (showInstructions) {
                ctx.fillStyle = 'red';
                ctx.font = '24px Arial';
                ctx.fillText('Punch with space bar', canvas.width / 2 - 100, 50);
                ctx.fillText('Crunch crabs with down arrow', canvas.width / 2 - 130, 80);
            }
        }
    }

    function drawBonus() {
        ctx.drawImage(bonusImage, canvas.width / 2 - 100, canvas.height / 2 - 100, 200, 200);
        bonusTimer--;
        if (bonusTimer <= 0) {
            showBonus = false;
        }
    }

    // Event listeners
    document.addEventListener('keydown', (event) => {
        if (event.code === 'Space' && !eric.punching) {
            eric.punching = true;
            eric.punchDuration = 0;
            currentPunchImage = Math.random() < 0.5 ? ericPunchImage1 : ericPunchImage2;
            punchSound.play().catch(e => console.error("Error playing punch sound:", e));
        }
    });

    document.addEventListener('keydown', (event) => {
        if (event.code === 'ArrowDown' && !eric.crunching) {
            eric.crunching = true;
            eric.crunchDuration = 0;
        }
    });

    document.addEventListener('keydown', () => {
        if (gameMusic.paused) {
            startGameMusic();
        }
    });

    // Asset loading and game initialization
    Promise.all([
        ...ericImages, 
        ericPunchImage1,
        ericPunchImage2,
        ...mickeyImages, 
        mickeyHitImage,
        ...mickeyDieImages,
        ...punchEffects,
        ...crabImages,
        ericPinchedImage,
        ericCrunchImage,
        crabCrunchImage,
        ...crabDieImages,
        new Promise(resolve => {
            cloudBackground.onload = resolve;
            cloudBackground.onerror = () => {
                console.error("Failed to load cloud background");
                resolve(); // Resolve anyway to not block the game
            };
        }),
        new Promise(resolve => {
            oceanBackground.onload = resolve;
            oceanBackground.onerror = () => {
                console.error("Failed to load ocean background");
                resolve(); // Resolve anyway to not block the game
            };
        }),
        bonusImage,
        new Promise(resolve => {
            gameMusic.addEventListener('canplaythrough', resolve, { once: true });
            gameMusic.addEventListener('error', (e) => {
                console.error("Error loading game music:", e);
                resolve();
            });
        }),
        new Promise(resolve => {
            deathSound.addEventListener('canplaythrough', resolve, { once: true });
        }),
        new Promise(resolve => {
            bonusSound.addEventListener('canplaythrough', resolve, { once: true });
        }),
        new Promise(resolve => {
            ericOuchSound.addEventListener('canplaythrough', resolve, { once: true });
        }),
        new Promise(resolve => {
            fuckCrabSound.addEventListener('canplaythrough', resolve, { once: true });
        })
    ].map(asset => {
        if (asset instanceof HTMLImageElement) {
            return new Promise(resolve => {
                if (asset.complete) resolve();
                else asset.onload = resolve;
            });
        }
        return asset;
    }))
    .then(() => {
        console.log("All assets loaded, starting game loop");
        startGameMusic();
        gameLoop();
    })
    .catch(error => {
        console.error("Error during game initialization:", error);
        // You might want to display an error message to the user here
    });

    console.log("Game script finished loading");
});

// console.log("Game script started");

// document.addEventListener('DOMContentLoaded', function() {
//     const canvas = document.getElementById('gameCanvas');
//     const ctx = canvas.getContext('2d');

//     // Game variables
//     let gameSpeed = 1;
//     const GROUND_HEIGHT = 100;
//     let score = 0;
//     let frameCount = 0;
//     let gameStartTime = Date.now();
//     const MICKEY_MAX_HITS = 6;
//     let mickeyHitCount = 0;
//     let scoreColor = 'black';
//     let showInstructions = true;
//     let crabTimer = 0;
//     const getCrabSpawnInterval = () => Math.floor(1200 / gameSpeed);

//     // Background images
//     const oceanBackground = new Image();
//     oceanBackground.src = 'assets/ImpossibleLoop01.png';
//     let oceanBackgroundX = 0;

//     const cloudBackground = new Image();
//     cloudBackground.src = 'assets/ImpossibleClouds01.png';
//     let cloudBackgroundX = 0;

//     // Eric character
//     const eric = {
//         x: -300, // Original position near the left side
//         y: canvas.height - GROUND_HEIGHT - 400,
//         width: 900,
//         height: 500,
//         frameX: 0,
//         frameY: 0,
//         speed: 9,
//         walking: true,
//         punching: false,
//         punchDuration: 0,
//         punchHitboxWidth: 100,
//         punchHitboxOffset: 700,
//         pinched: false,
//         pinchedDuration: 0
//     };

//     // Eric's walking animation
//     const ericImages = [];
//     for (let i = 1; i <= 8; i++) {
//         const img = new Image();
//         img.src = `assets/EricRun${i}.png`;
//         ericImages.push(img);
//     }

//     // Eric's punch images
//     const ericPunchImage1 = new Image();
//     ericPunchImage1.src = 'assets/ericPunch.png';
//     const ericPunchImage2 = new Image();
//     ericPunchImage2.src = 'assets/ericPunch2.png';
//     let currentPunchImage = ericPunchImage1;

//     // Eric pinched image
//     const ericPinchedImage = new Image();
//     ericPinchedImage.src = 'assets/ericPinched.png';

//     // Punch effect animations
//     const punchEffects = [];
//     for (let i = 1; i <= 3; i++) {
//         const img = new Image();
//         img.src = `assets/PunchEffect${i}.png`;
//         punchEffects.push(img);
//     }

//     // Mickey character
//     const mickey = {
//         x: canvas.width,
//         y: canvas.height - GROUND_HEIGHT - 400,
//         width: 900,
//         height: 500,
//         frameX: 0,
//         speed: 2,
//         visible: true,
//         state: 'walking',
//         hitDuration: 0,
//         staggerDistance: 50,
//         hitboxWidth: 100,
//         hitboxOffset: 400,
//         deathFrame: 0,
//         deathAnimationDuration: 0,
//         punchEffectIndex: -1,
//         punchEffectDuration: 0
//     };

//     // Mickey's walking animation
//     const mickeyImages = [];
//     for (let i = 1; i <= 21; i++) {
//         const img = new Image();
//         img.src = `assets/MickeyWalk${i.toString().padStart(2, '0')}.png`;
//         mickeyImages.push(img);
//     }

//     // Mickey's hit image
//     const mickeyHitImage = new Image();
//     mickeyHitImage.src = 'assets/MickeyHit.png';

//     // Mickey's death animation
//     const mickeyDieImages = [];
//     for (let i = 1; i <= 3; i++) {
//         const img = new Image();
//         img.src = `assets/MickeyDie${i}.png`;
//         mickeyDieImages.push(img);
//     }

//     // Crab character
//     const crab = {
//     x: canvas.width,
//     y: canvas.height - GROUND_HEIGHT - 300,
//     width: 1000,
//     height: 500,
//     frameX: 0,
//     baseSpeed: 3, // Add this line
//     speed: 2,
//     visible: false
// };
//     // Crab walking animation
//     const crabImages = [];
//     for (let i = 1; i <= 5; i++) {
//         const img = new Image();
//         img.src = `assets/crabWalk${i}.png`;
//         crabImages.push(img);
//     }

//     // Sounds
//     const punchSound = new Audio('assets/PunchSound.mp3');
//     const mickeyNoises = [
//         new Audio('assets/MickeyNoise1.mp3'),
//         new Audio('assets/MickeyNoise2.mp3'),
//         new Audio('assets/MickeyNoise3.mp3'),
//         new Audio('assets/MickeyNoise4.mp3'),
//         new Audio('assets/MickeyNoise5.mp3'),
//         new Audio('assets/MickeyNoise6.mp3'),
//         new Audio('assets/MickeyNoise7.mp3')
//     ];
//     let currentMickeyNoiseIndex = 0;

//     // Eric ouch sound
//     const ericOuchSound = new Audio('assets/ericOuch.mp3');

//     // Game music setup
//     const gameMusic = new Audio('assets/GameMusic.mp3');
//     gameMusic.loop = true;
//     const deathSound = new Audio('assets/deathSound.mp3');
//     const bonusSound = new Audio('assets/bonusSound.mp3');

//     // Bonus image
//     const bonusImage = new Image();
//     bonusImage.src = 'assets/Bonus.png';
//     let showBonus = false;
//     let bonusTimer = 0;

//     // Error handling for asset loading
//     function handleAssetError(asset, name) {
//         console.error(`Failed to load ${name}: ${asset.src || asset.currentSrc}`);
//     }

//     [oceanBackground, cloudBackground, ...ericImages, ericPunchImage1, ericPunchImage2, ...punchEffects, 
//      ...mickeyImages, mickeyHitImage, ...mickeyDieImages, bonusImage, ericPinchedImage, ...crabImages].forEach(img => {
//         img.onerror = () => handleAssetError(img, 'image');
//     });

//     [punchSound, ...mickeyNoises, gameMusic, deathSound, bonusSound, ericOuchSound].forEach(audio => {
//         audio.onerror = () => handleAssetError(audio, 'audio');
//     });

//     // Function to start game music
//     function startGameMusic() {
//         gameMusic.play().catch(e => {
//             console.error("Error playing game music:", e);
//             document.addEventListener('click', () => {
//                 gameMusic.play().catch(e => console.error("Error playing game music after click:", e));
//             }, { once: true });
//         });
//     }

//     // Game loop
//     function gameLoop() {
//         ctx.clearRect(0, 0, canvas.width, canvas.height);

//         updateBackground();
//         updateEric();
//         updateMickey();
//         updateCrab();

//         drawBackground();
//         drawEric();
//         drawMickey();
//         drawCrab();
//         drawScore();
//         drawInstructions();
        
//         if (showBonus) {
//             drawBonus();
//         }

//         gameSpeed += 0.0003;
//         frameCount++;

//         requestAnimationFrame(gameLoop);
//     }

//     // Update functions
//     function updateBackground() {
//         oceanBackgroundX -= gameSpeed;
//         if (oceanBackgroundX <= -canvas.width) {
//             oceanBackgroundX = 0;
//         }

//         cloudBackgroundX -= gameSpeed * 0.5;
//         if (cloudBackgroundX <= -canvas.width) {
//             cloudBackgroundX = 0;
//         }
//     }

//     function updateEric() {
//         if (eric.walking && !eric.punching && !eric.pinched) {
//             if (frameCount % 15 === 0) {
//                 eric.frameX = (eric.frameX + 1) % 8;
//             }
//         }
//         if (eric.punching) {
//             eric.punchDuration++;
//             if (eric.punchDuration > 30) {
//                 eric.punching = false;
//                 eric.punchDuration = 0;
//             }
//         }
//         if (eric.pinched) {
//             eric.pinchedDuration++;
//             if (eric.pinchedDuration > 30) { // Reduced to 0.5 seconds (30 frames)
//                 eric.pinched = false;
//                 eric.pinchedDuration = 0;
//             }
//         }
//     }

//     function updateMickey() {
//         if (mickey.visible) {
//             switch(mickey.state) {
//                 case 'walking':
//                     mickey.x -= mickey.speed;
//                     if (frameCount % 5 === 0) {
//                         mickey.frameX = (mickey.frameX + 1) % 21;
//                     }
//                     if (mickey.x + mickey.hitboxOffset < eric.x) {
//                         respawnMickey();
//                     }
//                     break;
//                 case 'hit':
//                     mickey.hitDuration++;
//                     if (mickey.hitDuration <= 30) {
//                         mickey.x += mickey.speed * 0.5;
//                     } else if (mickey.hitDuration > 60) {
//                         mickey.state = 'walking';
//                         mickey.hitDuration = 0;
//                     }
//                     break;
//                 case 'dying':
//                     mickey.deathAnimationDuration++;
//                     if (mickey.deathAnimationDuration % 20 === 0) {
//                         mickey.deathFrame = (mickey.deathFrame + 1) % 3;
//                     }
//                     if (mickey.deathAnimationDuration > 60) {
//                         respawnMickey();
//                     }
//                     break;
//             }

//             if (mickey.punchEffectIndex !== -1) {
//                 mickey.punchEffectDuration++;
//                 if (mickey.punchEffectDuration > 30) {
//                     mickey.punchEffectIndex = -1;
//                     mickey.punchEffectDuration = 0;
//                 }
//             }

            
//             if (eric.punching && 
//                 eric.punchDuration >= 5 && eric.punchDuration <= 20 && 
//                 mickey.state === 'walking' &&
//                 mickey.x + mickey.hitboxOffset < eric.x + eric.punchHitboxOffset + eric.punchHitboxWidth &&
//                 mickey.x + mickey.hitboxOffset + mickey.hitboxWidth > eric.x + eric.punchHitboxOffset) {
//                 mickey.x = eric.x + eric.punchHitboxOffset + eric.punchHitboxWidth - mickey.hitboxOffset - mickey.hitboxWidth + 50;
//                 hitMickey();
//             }
//         }
//     }

//     function updateCrab() {
//     if (crab.visible) {
//         crab.speed = crab.baseSpeed * gameSpeed; // Update this line
//         crab.x -= crab.speed;
//         if (frameCount % Math.max(1, Math.floor(10 / gameSpeed)) === 0) { // Update this line
//             crab.frameX = (crab.frameX + 1) % 5;
//         }
//         if (crab.x + crab.width < 0) {
//             crab.visible = false;
//             eric.pinched = true;
//             eric.pinchedDuration = 0;
//             ericOuchSound.play().catch(e => console.error("Error playing Eric ouch sound:", e));
//         }
//     } else {
//         crabTimer++;
//         if (crabTimer >= getCrabSpawnInterval()) {
//             crab.x = canvas.width;
//             crab.visible = true;
//             crabTimer = 0;
//         }
//     }
// }
//     function hitMickey() {
//         mickeyHitCount++;
//         if (mickeyHitCount >= MICKEY_MAX_HITS) {
//             mickey.state = 'dying';
//             mickey.deathFrame = 0;
//             mickey.deathAnimationDuration = 0;
//             deathSound.play().catch(e => console.error("Error playing death sound:", e));
//             setTimeout(() => {
//                 bonusSound.play().catch(e => console.error("Error playing bonus sound:", e));
//                 score += 10;
//                 scoreColor = 'red';
//                 setTimeout(() => { scoreColor = 'black'; }, 1000);
//                 showBonus = true;
//                 bonusTimer = 60;
//             }, 1000);
//         } else {
//             mickey.state = 'hit';
//             mickey.hitDuration = 0;
//             mickeyNoises[currentMickeyNoiseIndex].play().catch(e => console.error("Error playing Mickey noise:", e));
//             currentMickeyNoiseIndex = (currentMickeyNoiseIndex + 1) % mickeyNoises.length;
//         }
//         mickey.punchEffectIndex = Math.floor(Math.random() * 3);
//         mickey.punchEffectDuration = 0;
//         score++;
//     }

//     function respawnMickey() {
//         mickey.x = canvas.width;
//         mickey.visible = true;
//         mickey.state = 'walking';
//         mickey.speed += 0.1;
//         mickeyHitCount = 0;
//         mickey.frameX = 0;
//     }

//     // Draw functions
//     function drawBackground() {
//         ctx.drawImage(cloudBackground, cloudBackgroundX, 0, canvas.width, canvas.height);
//         ctx.drawImage(cloudBackground, cloudBackgroundX + canvas.width, 0, canvas.width, canvas.height);
//         ctx.drawImage(oceanBackground, oceanBackgroundX, 0, canvas.width, canvas.height);
//         ctx.drawImage(oceanBackground, oceanBackgroundX + canvas.width, 0, canvas.width, canvas.height);
//     }

//     function drawEric() {
//         if (eric.pinched) {
//             ctx.drawImage(ericPinchedImage, eric.x, eric.y, eric.width, eric.height);
//         } else if (eric.punching) {
//             ctx.drawImage(currentPunchImage, eric.x, eric.y, eric.width, eric.height);
//         } else {
//             ctx.drawImage(ericImages[eric.frameX], eric.x, eric.y, eric.width, eric.height);
//         }
//     }

//     function drawMickey() {
//         if (mickey.visible) {
//             switch(mickey.state) {
//                 case 'walking':
//                     ctx.drawImage(mickeyImages[mickey.frameX], mickey.x, mickey.y, mickey.width, mickey.height);
//                     break;
//                 case 'hit':
//                     ctx.drawImage(mickeyHitImage, mickey.x, mickey.y, mickey.width, mickey.height);
//                     break;
//                 case 'dying':
//                     ctx.drawImage(mickeyDieImages[mickey.deathFrame], mickey.x, mickey.y, mickey.width, mickey.height);
//                     break;
//             }

//             if (mickey.punchEffectIndex !== -1) {
//                 ctx.drawImage(punchEffects[mickey.punchEffectIndex], 
//                     mickey.x + mickey.width / 2 - 100, 
//                     mickey.y + mickey.height / 2 - 100, 
//                     200, 200);
//             }
//         }
//     }

//     function drawCrab() {
//     if (crab.visible) {
//         ctx.drawImage(crabImages[crab.frameX], crab.x, crab.y, crab.width, crab.height);
//     }
// }

//     function drawScore() {
//         ctx.fillStyle = scoreColor;
//         ctx.font = '20px Arial';
//         ctx.fillText(`Score: ${score}`, 10, 30);
//     }

//     function drawInstructions() {
//         const currentTime = Date.now();
//         const elapsedTime = currentTime - gameStartTime;
        
//         if (elapsedTime < 10000) { // Show for 10 seconds
//             // Change state every 1 second (1000 milliseconds)
//             showInstructions = Math.floor(elapsedTime / 1000) % 2 === 0;
            
//             if (showInstructions) {
//                 ctx.fillStyle = 'red';
//                 ctx.font = '24px Arial';
//                 ctx.fillText('Punch with space bar', canvas.width / 2 - 100, 50);
//             }
//         }
//     }

//     function drawBonus() {
//         ctx.drawImage(bonusImage, canvas.width / 2 - 100, canvas.height / 2 - 100, 200, 200);
//         bonusTimer--;
//         if (bonusTimer <= 0) {
//             showBonus = false;
//         }
//     }

//     // Event listeners
//     document.addEventListener('keydown', (event) => {
//         if (event.code === 'Space' && !eric.punching) {
//             eric.punching = true;
//             eric.punchDuration = 0;
//             currentPunchImage = Math.random() < 0.5 ? ericPunchImage1 : ericPunchImage2;
//             punchSound.play().catch(e => console.error("Error playing punch sound:", e));
//         }
//     });

//     document.addEventListener('keydown', () => {
//         if (gameMusic.paused) {
//             startGameMusic();
//         }
//     });

//     // Asset loading and game initialization
//     Promise.all([
//         ...ericImages, 
//         ericPunchImage1,
//         ericPunchImage2,
//         ...mickeyImages, 
//         mickeyHitImage,
//         ...mickeyDieImages,
//         ...punchEffects,
//         ...crabImages,
//         ericPinchedImage,
//         new Promise(resolve => {
//             cloudBackground.onload = resolve;
//             cloudBackground.onerror = () => {
//                 console.error("Failed to load cloud background");
//                 resolve(); // Resolve anyway to not block the game
//             };
//         }),
//         new Promise(resolve => {
//             oceanBackground.onload = resolve;
//             oceanBackground.onerror = () => {
//                 console.error("Failed to load ocean background");
//                 resolve(); // Resolve anyway to not block the game
//             };
//         }),
//         bonusImage,
//         new Promise(resolve => {
//             gameMusic.addEventListener('canplaythrough', resolve, { once: true });
//             gameMusic.addEventListener('error', (e) => {
//                 console.error("Error loading game music:", e);
//                 resolve();
//             });
//         }),
//         new Promise(resolve => {
//             deathSound.addEventListener('canplaythrough', resolve, { once: true });
//         }),
//         new Promise(resolve => {
//             bonusSound.addEventListener('canplaythrough', resolve, { once: true });
//         }),
//         new Promise(resolve => {
//             ericOuchSound.addEventListener('canplaythrough', resolve, { once: true });
//         })
//     ].map(asset => {
//         if (asset instanceof HTMLImageElement) {
//             return new Promise(resolve => {
//                 if (asset.complete) resolve();
//                 else asset.onload = resolve;
//             });
//         }
//         return asset;
//     }))
//     .then(() => {
//         console.log("All assets loaded, starting game loop");
//         startGameMusic();
//         gameLoop();
//     })
//     .catch(error => {
//         console.error("Error during game initialization:", error);
//         // You might want to display an error message to the user here
//     });

//     console.log("Game script finished loading");
// });

