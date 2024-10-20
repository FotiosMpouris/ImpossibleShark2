// Debugging: Log when the script starts
console.log("Game script started");

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Game variables
let gameSpeed = 5;
const GROUND_HEIGHT = 100;
let score = 0;
let frameCount = 0;
let gameStartTime = Date.now();
const MICKEY_MAX_HITS = 6;
let mickeyHitCount = 0;

// Background image
const backgroundImage = new Image();
backgroundImage.src = 'assets/ImpossibleLoop01.png';
let backgroundX = 0;

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
    punchHitboxOffset: 700
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

// Sounds
const punchSound = new Audio('assets/PunchSound.mp3');
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

// New audio elements
const gameMusic = new Audio('assets/GameMusic.mp3');
gameMusic.loop = true;
const deathSound = new Audio('assets/deathSound.mp3');
const bonusSound = new Audio('assets/bonusSound.mp3');

// Bonus image
const bonusImage = new Image();
bonusImage.src = 'assets/Bonus.png';
let showBonus = false;
let bonusTimer = 0;

// Error handling for audio loading
[punchSound, ...mickeyNoises, gameMusic, deathSound, bonusSound].forEach(audio => {
    audio.onerror = function() {
        console.error(`Failed to load audio: ${audio.src}`);
    };
});

// Game loop
function gameLoop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    updateBackground();
    updateEric();
    updateMickey();

    drawBackground();
    drawEric();
    drawMickey();
    drawScore();
    drawInstructions();
    
    if (showBonus) {
        drawBonus();
    }

    gameSpeed += 0.0001;

    requestAnimationFrame(gameLoop);
}

// Update functions
function updateBackground() {
    backgroundX -= gameSpeed;
    if (backgroundX <= -canvas.width) {
        backgroundX = 0;
    }
}

function updateEric() {
    if (eric.walking && !eric.punching) {
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
    frameCount++;
}

function updateMickey() {
    if (mickey.visible) {
        switch(mickey.state) {
            case 'walking':
                mickey.x -= mickey.speed;
                if (frameCount % 5 === 0) {
                    mickey.frameX = (mickey.frameX + 1) % 21;
                }
                // Check if Mickey walked past Eric
                if (mickey.x + mickey.hitboxOffset < eric.x) {
                    respawnMickey();
                }
                break;
            case 'hit':
                mickey.hitDuration++;
                if (mickey.hitDuration <= 30) {
                    mickey.x += mickey.speed * 0.5; // Stagger backwards
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

        // Update punch effect
        if (mickey.punchEffectIndex !== -1) {
            mickey.punchEffectDuration++;
            if (mickey.punchEffectDuration > 30) {
                mickey.punchEffectIndex = -1;
                mickey.punchEffectDuration = 0;
            }
        }

        // Check for collision with Eric's punch
        if (eric.punching && 
            eric.punchDuration >= 5 && eric.punchDuration <= 20 && 
            mickey.state === 'walking' &&
            mickey.x + mickey.hitboxOffset < eric.x + eric.punchHitboxOffset + eric.punchHitboxWidth &&
            mickey.x + mickey.hitboxOffset + mickey.hitboxWidth > eric.x + eric.punchHitboxOffset) {
            hitMickey();
        }
    }
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
            score += 10;  // Add 10 bonus points
            showBonus = true;
            bonusTimer = 60;  // Show bonus image for 60 frames (about 1 second)
        }, 1000);  // Wait for 1 second after death sound
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
    mickey.frameX = 0;  // Reset the walk animation frame
}

// Draw functions
function drawBackground() {
    ctx.drawImage(backgroundImage, backgroundX, 0, canvas.width, canvas.height);
    ctx.drawImage(backgroundImage, backgroundX + canvas.width, 0, canvas.width, canvas.height);
}

function drawEric() {
    if (eric.punching) {
        ctx.drawImage(currentPunchImage, eric.x, eric.y, eric.width, eric.height);
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

        // Draw punch effect
        if (mickey.punchEffectIndex !== -1) {
            ctx.drawImage(punchEffects[mickey.punchEffectIndex], 
                mickey.x + mickey.width / 2 - 100, 
                mickey.y + mickey.height / 2 - 100, 
                200, 200);
        }
    }
}

function drawScore() {
    ctx.fillStyle = 'black';
    ctx.font = '20px Arial';
    ctx.fillText(`Score: ${score}`, 10, 30);
}

function drawInstructions() {
    const currentTime = Date.now();
    if (currentTime - gameStartTime < 10000) {  // 10 seconds
        ctx.fillStyle = 'black';
        ctx.font = '24px Arial';
        ctx.fillText('Punch with space bar', canvas.width / 2 - 100, 50);
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

// Debugging: Log when all assets are loaded
Promise.all([
    ...ericImages, 
    ericPunchImage1,
    ericPunchImage2,
    ...mickeyImages, 
    mickeyHitImage,
    ...mickeyDieImages,
    ...punchEffects,
    backgroundImage,
    bonusImage,
    new Promise(resolve => {
        gameMusic.oncanplaythrough = resolve;
        deathSound.oncanplaythrough = resolve;
        bonusSound.oncanplaythrough = resolve;
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
    gameMusic.play().catch(e => console.error("Error playing game music:", e));
    gameLoop();
})
.catch(error => {
    console.error("Error loading assets:", error);
});

console.log("Game script finished loading");

// // Debugging: Log when the script starts
// console.log("Game script started");

// const canvas = document.getElementById('gameCanvas');
// const ctx = canvas.getContext('2d');

// // Game variables
// let gameSpeed = 1;
// const GROUND_HEIGHT = 100;
// let score = 0;
// let frameCount = 0;
// let gameStartTime = Date.now();
// const MICKEY_MAX_HITS = 6;
// let mickeyHitCount = 0;

// // Background image
// const backgroundImage = new Image();
// backgroundImage.src = 'assets/ImpossibleLoop01.png';
// let backgroundX = 0;

// // Eric character
// const eric = {
//     x: -300,
//     y: canvas.height - GROUND_HEIGHT - 400,
//     width: 900,
//     height: 500,
//     frameX: 0,
//     frameY: 0,
//     speed: 9,
//     walking: true,
//     punching: false,
//     punchDuration: 0,
//     punchHitboxWidth: 100,
//     punchHitboxOffset: 700
// };

// // Eric's walking animation
// const ericImages = [];
// for (let i = 1; i <= 8; i++) {
//     const img = new Image();
//     img.src = `assets/EricRun${i}.png`;
//     ericImages.push(img);
// }

// // Eric's punch images
// const ericPunchImage1 = new Image();
// ericPunchImage1.src = 'assets/ericPunch.png';
// const ericPunchImage2 = new Image();
// ericPunchImage2.src = 'assets/ericPunch2.png';
// let currentPunchImage = ericPunchImage1;

// // Punch effect animations
// const punchEffects = [];
// for (let i = 1; i <= 3; i++) {
//     const img = new Image();
//     img.src = `assets/PunchEffect${i}.png`;
//     punchEffects.push(img);
// }

// // Mickey character
// const mickey = {
//     x: canvas.width,
//     y: canvas.height - GROUND_HEIGHT - 400,
//     width: 900,
//     height: 500,
//     frameX: 0,
//     speed: 2,
//     visible: true,
//     state: 'walking',
//     hitDuration: 0,
//     staggerDistance: 50,
//     hitboxWidth: 100,
//     hitboxOffset: 400,
//     deathFrame: 0,
//     deathAnimationDuration: 0,
//     punchEffectIndex: -1,
//     punchEffectDuration: 0
// };

// // Mickey's walking animation
// const mickeyImages = [];
// for (let i = 1; i <= 21; i++) {
//     const img = new Image();
//     img.src = `assets/MickeyWalk${i.toString().padStart(2, '0')}.png`;
//     mickeyImages.push(img);
// }

// // Mickey's hit image
// const mickeyHitImage = new Image();
// mickeyHitImage.src = 'assets/MickeyHit.png';

// // Mickey's death animation
// const mickeyDieImages = [];
// for (let i = 1; i <= 3; i++) {
//     const img = new Image();
//     img.src = `assets/MickeyDie${i}.png`;
//     mickeyDieImages.push(img);
// }

// // Sounds
// const punchSound = new Audio('assets/PunchSound.mp3');
// const mickeyNoises = [
//     new Audio('assets/MickeyNoise1.mp3'),
//     new Audio('assets/MickeyNoise2.mp3'),
//     new Audio('assets/MickeyNoise3.mp3'),
//     new Audio('assets/MickeyNoise4.mp3'),
//     new Audio('assets/MickeyNoise5.mp3'),
//     new Audio('assets/MickeyNoise6.mp3'),
//     new Audio('assets/MickeyNoise7.mp3')
// ];
// let currentMickeyNoiseIndex = 0;

// // Error handling for audio loading
// [punchSound, ...mickeyNoises].forEach(audio => {
//     audio.onerror = function() {
//         console.error(`Failed to load audio: ${audio.src}`);
//     };
// });

// // Game loop
// function gameLoop() {
//     ctx.clearRect(0, 0, canvas.width, canvas.height);

//     updateBackground();
//     updateEric();
//     updateMickey();

//     drawBackground();
//     drawEric();
//     drawMickey();
//     drawScore();
//     drawInstructions();

//     gameSpeed += 0.0001;

//     requestAnimationFrame(gameLoop);
// }

// // Update functions
// function updateBackground() {
//     backgroundX -= gameSpeed;
//     if (backgroundX <= -canvas.width) {
//         backgroundX = 0;
//     }
// }

// function updateEric() {
//     if (eric.walking && !eric.punching) {
//         if (frameCount % 15 === 0) {
//             eric.frameX = (eric.frameX + 1) % 8;
//         }
//     }
//     if (eric.punching) {
//         eric.punchDuration++;
//         if (eric.punchDuration > 30) {
//             eric.punching = false;
//             eric.punchDuration = 0;
//         }
//     }
//     frameCount++;
// }

// function updateMickey() {
//     if (mickey.visible) {
//         switch(mickey.state) {
//             case 'walking':
//                 mickey.x -= mickey.speed;
//                 if (frameCount % 5 === 0) {
//                     mickey.frameX = (mickey.frameX + 1) % 21;
//                 }
//                 // Check if Mickey walked past Eric
//                 if (mickey.x + mickey.hitboxOffset < eric.x) {
//                     respawnMickey();
//                 }
//                 break;
//             case 'hit':
//                 mickey.hitDuration++;
//                 if (mickey.hitDuration <= 30) {
//                     mickey.x += mickey.speed * 0.5; // Stagger backwards
//                 } else if (mickey.hitDuration > 60) {
//                     mickey.state = 'walking';
//                     mickey.hitDuration = 0;
//                 }
//                 break;
//             case 'dying':
//                 mickey.deathAnimationDuration++;
//                 if (mickey.deathAnimationDuration % 20 === 0) {
//                     mickey.deathFrame = (mickey.deathFrame + 1) % 3;
//                 }
//                 if (mickey.deathAnimationDuration > 60) {
//                     respawnMickey();
//                 }
//                 break;
//         }

//         // Update punch effect
//         if (mickey.punchEffectIndex !== -1) {
//             mickey.punchEffectDuration++;
//             if (mickey.punchEffectDuration > 30) {
//                 mickey.punchEffectIndex = -1;
//                 mickey.punchEffectDuration = 0;
//             }
//         }

//         // Check for collision with Eric's punch
//         if (eric.punching && 
//             eric.punchDuration >= 5 && eric.punchDuration <= 20 && 
//             mickey.state === 'walking' &&
//             mickey.x + mickey.hitboxOffset < eric.x + eric.punchHitboxOffset + eric.punchHitboxWidth &&
//             mickey.x + mickey.hitboxOffset + mickey.hitboxWidth > eric.x + eric.punchHitboxOffset) {
//             hitMickey();
//         }
//     }
// }

// function hitMickey() {
//     mickeyHitCount++;
//     if (mickeyHitCount >= MICKEY_MAX_HITS) {
//         mickey.state = 'dying';
//         mickey.deathFrame = 0;
//         mickey.deathAnimationDuration = 0;
//     } else {
//         mickey.state = 'hit';
//         mickey.hitDuration = 0;
//         mickeyNoises[currentMickeyNoiseIndex].play().catch(e => console.error("Error playing Mickey noise:", e));
//         currentMickeyNoiseIndex = (currentMickeyNoiseIndex + 1) % mickeyNoises.length;
//     }
//     mickey.punchEffectIndex = Math.floor(Math.random() * 3);
//     mickey.punchEffectDuration = 0;
//     score++;
// }

// function respawnMickey() {
//     mickey.x = canvas.width;
//     mickey.visible = true;
//     mickey.state = 'walking';
//     mickey.speed += 0.1;
//     mickeyHitCount = 0;
// }

// // Draw functions
// function drawBackground() {
//     ctx.drawImage(backgroundImage, backgroundX, 0, canvas.width, canvas.height);
//     ctx.drawImage(backgroundImage, backgroundX + canvas.width, 0, canvas.width, canvas.height);
// }

// function drawEric() {
//     if (eric.punching) {
//         ctx.drawImage(currentPunchImage, eric.x, eric.y, eric.width, eric.height);
//     } else {
//         ctx.drawImage(ericImages[eric.frameX], eric.x, eric.y, eric.width, eric.height);
//     }
// }

// function drawMickey() {
//     if (mickey.visible) {
//         switch(mickey.state) {
//             case 'walking':
//                 ctx.drawImage(mickeyImages[mickey.frameX], mickey.x, mickey.y, mickey.width, mickey.height);
//                 break;
//             case 'hit':
//                 ctx.drawImage(mickeyHitImage, mickey.x, mickey.y, mickey.width, mickey.height);
//                 break;
//             case 'dying':
//                 ctx.drawImage(mickeyDieImages[mickey.deathFrame], mickey.x, mickey.y, mickey.width, mickey.height);
//                 break;
//         }

//         // Draw punch effect
//         if (mickey.punchEffectIndex !== -1) {
//             ctx.drawImage(punchEffects[mickey.punchEffectIndex], 
//                 mickey.x + mickey.width / 2 - 100, 
//                 mickey.y + mickey.height / 2 - 100, 
//                 200, 200);
//         }
//     }
// }

// function drawScore() {
//     ctx.fillStyle = 'black';
//     ctx.font = '20px Arial';
//     ctx.fillText(`Score: ${score}`, 10, 30);
// }

// function drawInstructions() {
//     const currentTime = Date.now();
//     if (currentTime - gameStartTime < 10000) {  // 10 seconds
//         ctx.fillStyle = 'black';
//         ctx.font = '24px Arial';
//         ctx.fillText('Punch with space bar', canvas.width / 2 - 100, 50);
//     }
// }

// // Event listeners
// document.addEventListener('keydown', (event) => {
//     if (event.code === 'Space' && !eric.punching) {
//         eric.punching = true;
//         eric.punchDuration = 0;
//         currentPunchImage = Math.random() < 0.5 ? ericPunchImage1 : ericPunchImage2;
//         punchSound.play().catch(e => console.error("Error playing punch sound:", e));
//     }
// });

// // Debugging: Log when all assets are loaded
// Promise.all([
//     ...ericImages, 
//     ericPunchImage1,
//     ericPunchImage2,
//     ...mickeyImages, 
//     mickeyHitImage,
//     ...mickeyDieImages,
//     ...punchEffects,
//     backgroundImage
// ].map(img => new Promise(resolve => {
//     if (img.complete) resolve();
//     else img.onload = resolve;
// })))
// .then(() => {
//     console.log("All images loaded, starting game loop");
//     gameLoop();
// })
// .catch(error => {
//     console.error("Error loading images:", error);
// });

// console.log("Game script finished loading");

