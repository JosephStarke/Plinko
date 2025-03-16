// Setup the background color picker
function setupBackgroundColorPicker() {
    const backgroundPicker = document.getElementById('background-color-picker');
    if (backgroundPicker) {
        document.querySelectorAll('#background-color-picker .color-option').forEach(option => {
            option.addEventListener('click', function() {
                const color = this.dataset.color;
                config.backgroundColor = color;
                
                // Visual feedback
                document.querySelectorAll('#background-color-picker .color-option').forEach(o => {
                    o.style.border = '2px solid rgba(255, 255, 255, 0.2)';
                });
                this.style.border = '2px solid white';
            });
        });
    }
}

// Draw balls with icon
function drawBalls() {
    for (const ball of balls) {
        // Base ball
        ctx.fillStyle = config.ballColor;
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw Shiro icon on the ball with rotation
        const iconSize = ball.radius * 3; // 2x bigger (from 1.5 to 3)
        
        try {
            // Calculate rotation angle based on velocity
            const angle = Math.atan2(ball.velocityY, ball.velocityX);
            
            // Save the current canvas state
            ctx.save();
            
            // Translate to ball center, rotate, and draw image
            ctx.translate(ball.x, ball.y);
            ctx.rotate(angle + Math.PI/2); // Add 90 degrees to make it face the direction of movement
            
            const img = new Image();
            img.src = 'icon.png';
            
            // Only draw if the image is loaded
            if (img.complete) {
                ctx.drawImage(img, 
                    -iconSize/2, 
                    -iconSize/2, 
                    iconSize, 
                    iconSize);
            }
            
            // Restore canvas state
            ctx.restore();
        } catch (e) {
            // Fallback in case image loading fails
            console.log("Error drawing ball icon:", e);
        }
    }
}

// Game Configuration
const config = {
    rows: 16,
    holeValues: [],
    currentMultiplier: 1,
    ballColor: '#FFDE59',
    pegColor: '#FF4D8D',
    backgroundColor: '#1A1833',
    gameTitle: "PLINKO BURN",
    scorePrefix: "$SHIRO Burned:",
    score: 0,
    ballSize: 10,
    pegSize: 6,
    pegBounciness: 1.0,
    maxBalls: 50,
    ballsRemaining: 50,
    soundEnabled: true,
    editMode: false,
    customPegs: {},  // Store custom peg properties
    binMultiplier: 1, // Default 1x multiplier
    originalHoleValues: [], // Store original values before multiplication
    physics: {
        gravity: 0.1,      
        bounce: 0.68,        
        friction: 0.99
    },
    globalBounciness: 0.8   // Global bounce setting (can be configured)
};

// Game State
let balls = [];
let pegs = [];
let bins = [];
let animationId;
let scale = 1;
let currentEditingBinIndex = -1;
let currentEditingPeg = null;
let customPegColor = config.pegColor;
let audioContext;
let dropInterval = null;

// Fixed base values for game dimensions - this is the reference size
const BASE_WIDTH = 800;
// Adjusted to create more horizontal space for pegs
const BASE_HEIGHT_PER_ROW = 42; // Reduced from 50 to ensure all pegs are visible

// DOM elements - defined as variables first, will be assigned later
let canvas, ctx;
let editConfigBtn, configPanel, saveConfigBtn, cancelConfigBtn, resetBtn;
let numRowsInput, ballSizeInput, pegSizeInput, globalBounceInput;
let maxBallsInput, multiplierBtns, binMultiplierInput;
let gameTitleElement, gameTitleInput, scorePrefixElement, scorePrefixInput;
let scoreValueElement, ballCountElement, maxBallsElement;
let holeEditor, holeValueInput, saveHoleValueBtn, cancelHoleValueBtn;
let pegEditor, savePegPropertiesBtn, cancelPegPropertiesBtn;
let overlay, soundToggle, finalScoreOverlay, finalScorePrefix, finalScoreValue;
let playAgainBtn;

// Initialize default hole values - higher at edges, lower in middle
function initHoleValues() {
    config.holeValues = [];
    config.originalHoleValues = [];
    
    for (let i = 0; i < config.rows; i++) {
        let value;
        
        // Determine value based on position (higher at edges, lower in middle)
        if (i === 0 || i === config.rows - 1) {
            value = '100B'; // Doubled from 50B - Highest value at the edges
        } else {
            // Calculate distance from center (normalized 0-1)
            const center = (config.rows - 1) / 2;
            const distFromCenter = Math.abs(i - center) / center;
            
            // Values decrease toward the center (all doubled)
            if (distFromCenter > 0.8) {
                value = '40B';  // Doubled from 20B
            } else if (distFromCenter > 0.6) {
                value = '20B';  // Doubled from 10B
            } else if (distFromCenter > 0.4) {
                value = '10B';  // Doubled from 5B
            } else if (distFromCenter > 0.2) {
                value = '2B';   // Doubled from 1B
            } else {
                value = '1B';   // Doubled from 500M
            }
        }
        
        config.originalHoleValues.push(value);
        config.holeValues.push(value); // Initially same as original
    }
    
    // Apply multiplier to all values
    applyBinMultiplier();
}

// Function to apply bin multiplier and update bin values
function applyBinMultiplier() {
    const multiplier = parseInt(config.binMultiplier) || 1;
    
    for (let i = 0; i < config.originalHoleValues.length; i++) {
        const originalValue = parseValueNotation(config.originalHoleValues[i]);
        const multipliedValue = originalValue * multiplier;
        config.holeValues[i] = formatLargeNumber(multipliedValue);
    }
}

// Initialize the game
function initGame() {
    console.log("Initializing game...");
    
    // Get all DOM elements
    getElements();
    
    // Add decorative elements
    addDecorativeElements();
    
    // Initialize audio context
    initAudio();
    
    // Set canvas dimensions and calculate scale
    resizeCanvas();
    
    // Initialize hole values if empty
    if (config.holeValues.length === 0) {
        initHoleValues();
    }
    
    // Create pegs and bins
    createPegsAndBins();
    
    // Update UI with current configuration
    updateUI();
    
    // Set up all event listeners
    setupEventListeners();
    
    // Start the game loop
    gameLoop();
    console.log("Game initialization complete.");
}

// Get all DOM elements
function getElements() {
    canvas = document.getElementById('plinko-board');
    ctx = canvas.getContext('2d');
    editConfigBtn = document.getElementById('edit-config');
    configPanel = document.getElementById('config-panel');
    saveConfigBtn = document.getElementById('save-config');
    cancelConfigBtn = document.getElementById('cancel-config');
    resetBtn = document.getElementById('reset-btn');
    numRowsInput = document.getElementById('num-rows');
    ballSizeInput = document.getElementById('ball-size');
    pegSizeInput = document.getElementById('peg-size');
    globalBounceInput = document.getElementById('global-bounce');
    maxBallsInput = document.getElementById('max-balls-input');
    multiplierBtns = document.querySelectorAll('.multiplier-btn');
    gameTitleElement = document.getElementById('game-title');
    gameTitleInput = document.getElementById('game-title-input');
    scorePrefixElement = document.getElementById('score-prefix');
    scorePrefixInput = document.getElementById('score-prefix-input');
    scoreValueElement = document.getElementById('score-value');
    ballCountElement = document.getElementById('ball-count');
    maxBallsElement = document.getElementById('max-balls');
    holeEditor = document.getElementById('hole-editor');
    holeValueInput = document.getElementById('hole-value-input');
    saveHoleValueBtn = document.getElementById('save-hole-value');
    cancelHoleValueBtn = document.getElementById('cancel-hole-value');
    pegEditor = document.getElementById('peg-editor');
    savePegPropertiesBtn = document.getElementById('save-peg-properties');
    cancelPegPropertiesBtn = document.getElementById('cancel-peg-properties');
    overlay = document.getElementById('overlay');
    soundToggle = document.getElementById('sound-toggle');
    finalScoreOverlay = document.getElementById('final-score-overlay');
    finalScorePrefix = document.getElementById('final-score-prefix');
    finalScoreValue = document.getElementById('final-score-value');
    playAgainBtn = document.getElementById('play-again-btn');
    binMultiplierInput = document.getElementById('bin-multiplier-input');
    
    console.log("Elements loaded:", 
        !!canvas, !!configPanel, !!numRowsInput, 
        !!globalBounceInput, !!maxBallsInput);
}

// Initialize audio context
function initAudio() {
    try {
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
    } catch (e) {
        console.warn('AudioContext not supported');
    }
}

// Update UI elements with current configuration
function updateUI() {
    gameTitleElement.textContent = config.gameTitle;
    scorePrefixElement.textContent = config.scorePrefix;
    scoreValueElement.textContent = formatLargeNumber(config.score);
    ballCountElement.textContent = config.ballsRemaining;
    maxBallsElement.textContent = config.maxBalls;
    
    // Update button states based on remaining balls
    updateButtonStates();
}

// Update button states based on remaining balls
function updateButtonStates() {
    multiplierBtns.forEach(btn => {
        const multiplier = parseInt(btn.dataset.multiplier);
        
        // Instead of disabling buttons, mark them with a class for styling
        if (multiplier > config.ballsRemaining) {
            btn.classList.add('low-balls');
        } else {
            btn.classList.remove('low-balls');
        }
        
        // No longer disabling buttons
        btn.disabled = false;
    });
}

// Resize canvas while maintaining aspect ratio and scaling for row count
function resizeCanvas() {
    const container = canvas.parentElement;
    const containerWidth = container.clientWidth;
    
    // Calculate dynamic height based on number of rows
    // Add more vertical space to ensure all pegs fit
    const baseHeight = BASE_HEIGHT_PER_ROW * (config.rows + 2);
    
    // Calculate scale relative to base width
    scale = containerWidth / BASE_WIDTH;
    
    // Set canvas dimensions
    canvas.width = containerWidth;
    canvas.height = baseHeight * scale;
}

// Create pegs in a pyramid pattern and bins at the bottom
function createPegsAndBins() {
    pegs = [];
    bins = [];
    
    const pegSpacing = BASE_HEIGHT_PER_ROW * scale;
    const pegRadius = config.pegSize * scale;
    
    const startX = canvas.width / 2;
    const startY = pegSpacing * 1.5;
    
    // Create pegs
    for (let row = 0; row < config.rows; row++) {
        const numPegs = row + 3; // Start with 3 pegs in the first row
        const rowWidth = (numPegs - 1) * pegSpacing;
        const offsetX = startX - rowWidth / 2;
        
        for (let col = 0; col < numPegs; col++) {
            const pegId = `peg-${row}-${col}`;
            const customPeg = config.customPegs[pegId];
            
            pegs.push({
                x: offsetX + col * pegSpacing,
                y: startY + row * pegSpacing,
                radius: pegRadius,
                row: row,
                col: col,
                id: pegId,
                color: customPeg ? customPeg.color : config.pegColor,
                bounciness: customPeg ? customPeg.bounciness : config.pegBounciness
            });
        }
    }
    
    // Create bins as evenly spaced dividers
    const binY = startY + config.rows * pegSpacing + pegSpacing / 2;
    const numBins = config.rows;
    const binSpacing = canvas.width / numBins;
    
    for (let i = 0; i <= numBins; i++) {
        bins.push({
            x: i * binSpacing,
            y: binY,
            index: Math.min(i, numBins - 1)
        });
    }
}

// Initial ball drop with randomness for better distribution
function dropBall() {
    if (config.ballsRemaining <= 0) return false;
    
    // Resume AudioContext if suspended
    if (audioContext && audioContext.state === 'suspended') {
        audioContext.resume();
    }
    
    const ballRadius = config.ballSize * scale;
    
    // Add random initial conditions for more natural behavior
    const randomXOffset = (Math.random() * 6 - 3) * scale;
    // Small initial velocity with slight randomness
    const initialXVelocity = (Math.random() * 0.6 - 0.3) * scale;
    
    const ball = {
        x: canvas.width / 2 + randomXOffset,
        y: BASE_HEIGHT_PER_ROW * scale, // Start position above first peg
        radius: ballRadius,
        velocityX: initialXVelocity, 
        velocityY: 0.2 * scale, // Small initial downward velocity
        landed: false,
        binIndex: -1,
        lastPegHit: null, // Track last peg hit to prevent multiple collisions
        lastCollisionTime: 0, // Track time of last collision to prevent rapid collisions
    };
    
    balls.push(ball);
    config.ballsRemaining--;
    
    // Play ball drop sound
    playBallDropSound();
    
    // Update UI
    ballCountElement.textContent = config.ballsRemaining;
    updateButtonStates();
    
    return true;
}

// Drop multiple balls if available
function dropMultipleBalls(count) {
    // Use as many balls as available, up to requested count
    const ballsToUse = Math.min(count, config.ballsRemaining);
    if (ballsToUse <= 0) return;
    
    // Initialize audio context on first interaction
    if (audioContext && audioContext.state === 'suspended') {
        audioContext.resume();
    }
    
    for (let i = 0; i < ballsToUse; i++) {
        setTimeout(() => {
            const ballDropped = dropBall();
            
            // Check if this was the last ball
            if (config.ballsRemaining === 0) {
                // Set a timeout to show the final score after the last ball settles
                setTimeout(showFinalScore, 2500);
            }
        }, i * 100); // Delay each ball drop slightly
    }
}

// Show final score overlay when the game is over
function showFinalScore() {
    // Make sure all balls have settled or been removed
    if (balls.length > 0) {
        // If there are still balls in play, wait a bit longer
        setTimeout(showFinalScore, 1000);
        return;
    }
    
    // Update final score display
    finalScorePrefix.textContent = config.scorePrefix;
    finalScoreValue.textContent = formatLargeNumber(config.score);
    
    // Show the overlay
    finalScoreOverlay.classList.add('visible');
}

// Update ball positions and check for collisions
// IMPROVED PHYSICS: This function has been significantly rewritten
function updateBalls() {
    for (let i = balls.length - 1; i >= 0; i--) {
        const ball = balls[i];
        
        if (ball.landed) {
            if (ball.y > canvas.height + ball.radius * 4) {
                // Remove ball once it's off-screen
                balls.splice(i, 1);
            } else {
                // Continue falling after landing
                ball.y += 5 * scale;
            }
            continue;
        }
        
        // Apply gravity (scaled)
        ball.velocityY += config.physics.gravity * scale;
        
        // Apply friction
        ball.velocityX *= config.physics.friction;
        ball.velocityY *= config.physics.friction;
        
        // Update position
        ball.x += ball.velocityX;
        ball.y += ball.velocityY;
        
        // Check for peg collisions with improved interaction
        let collided = false;
        
        const currentTime = performance.now();
        
        for (const peg of pegs) {
            // Skip if this is the last peg we hit (prevents multiple collisions with same peg)
            if (peg === ball.lastPegHit) continue;
            
            // Skip if we just had a collision recently (prevents rapid multiple collisions)
            if (currentTime - ball.lastCollisionTime < 16) continue; // 16ms = ~1 frame at 60fps
            
            const dx = ball.x - peg.x;
            const dy = ball.y - peg.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const minDistance = ball.radius + peg.radius;
            
            if (distance < minDistance) {
                // Collision detected
                collided = true;
                ball.lastPegHit = peg; // Remember this peg
                ball.lastCollisionTime = currentTime;
                
                // Calculate normalized collision vector (from peg center to ball center)
                const nx = dx / distance;
                const ny = dy / distance;
                
                // Move the ball out of the peg (resolve overlap)
                const overlapDistance = minDistance - distance;
                ball.x += nx * overlapDistance * 1.02; // Slightly more to ensure separation
                ball.y += ny * overlapDistance * 1.02;
                
                // Calculate relative velocity along the normal
                const velAlongNormal = ball.velocityX * nx + ball.velocityY * ny;
                
                // Only bounce if objects are moving towards each other
                if (velAlongNormal < 0) {
                    // Calculate bounce impulse
                    const pegBounce = peg.bounciness; // Use per-peg bounciness
                    const bounceFactor = config.physics.bounce * pegBounce;
                    
                    // Apply bounce impulse to velocity (with a slight random variation for natural feel)
                    // Use global bounciness setting to scale the bounce effect
                    const randomBounceFactor = bounceFactor * (0.95 + Math.random() * 0.1) * config.globalBounciness;
                    const impulse = -velAlongNormal * (1 + randomBounceFactor);
                    
                    // Apply the impulse in the direction of the normal
                    ball.velocityX += impulse * nx;
                    ball.velocityY += impulse * ny;
                    
                    // Add a small random force for natural behavior
                    ball.velocityX += (Math.random() * 0.4 - 0.2) * scale;
                    ball.velocityY += (Math.random() * 0.2 - 0.1) * scale;
                }
                
                // Visual feedback - flash the peg
                peg.isFlashing = true;
                
                // Play sound for peg hit with velocity-based pitch
                const hitVelocity = Math.sqrt(
                    Math.pow(ball.velocityX, 2) + 
                    Math.pow(ball.velocityY, 2)
                );
                playPegHitSound(200 + hitVelocity * 100);
                
                // Only process one collision per frame to prevent energy gain
                break;
            }
        }
        
        // Clear lastPegHit if no collision this frame
        if (!collided) {
            ball.lastPegHit = null;
        }
        
        // Check for wall collisions
        if (ball.x - ball.radius < 0) {
            ball.x = ball.radius;
            ball.velocityX = -ball.velocityX * config.physics.bounce;
        } else if (ball.x + ball.radius > canvas.width) {
            ball.x = canvas.width - ball.radius;
            ball.velocityX = -ball.velocityX * config.physics.bounce;
        }
        
        // Check if ball has reached the bottom (bin line)
        if (ball.y > bins[0].y - ball.radius) {
            // Find which bin the ball landed in
            for (let b = 0; b < bins.length - 1; b++) {
                if (ball.x >= bins[b].x && ball.x < bins[b+1].x) {
                    ball.binIndex = b;
                    ball.landed = true;
                    
                    // Add to score
                    addToScore(config.holeValues[b]);
                    
                    // Show winning animation
                    const midX = (bins[b].x + bins[b+1].x) / 2;
                    showWinningAnimation(config.holeValues[b], midX, bins[0].y);
                    
                    // Play bucket sound
                    playBucketSound(b);
                    
                    break;
                }
            }
            
            // Handle edge case for rightmost position
            if (!ball.landed && ball.x >= bins[bins.length-1].x) {
                const lastIndex = config.holeValues.length - 1;
                ball.binIndex = lastIndex;
                ball.landed = true;
                
                // Add to score
                addToScore(config.holeValues[lastIndex]);
                
                // Show winning animation
                showWinningAnimation(config.holeValues[lastIndex], ball.x, bins[0].y);
                
                // Play bucket sound
                playBucketSound(lastIndex);
            }
        }
    }
}

// Reset the game
function resetGame() {
    // Clear any intervals
    if (dropInterval) {
        clearInterval(dropInterval);
        dropInterval = null;
    }
    
    // Hide final score overlay if visible
    finalScoreOverlay.classList.remove('visible');
    
    // Reset game state
    config.score = 0;
    config.ballsRemaining = config.maxBalls;
    balls = [];
    
    // Reset UI
    scoreValueElement.textContent = '0';
    ballCountElement.textContent = config.ballsRemaining;
    maxBallsElement.textContent = config.maxBalls;
    
    // Update button states
    updateButtonStates();
    
    // Reset first multiplier button to active
    multiplierBtns.forEach(btn => btn.classList.remove('active'));
    document.querySelector('.multiplier-btn[data-multiplier="1"]').classList.add('active');
    
    // Reset current multiplier
    config.currentMultiplier = 1;
}

// Parse value notation (1K, 1M, 1B, etc.) to numeric value
function parseValueNotation(valueStr) {
    const value = valueStr.toString().trim();
    const numericPart = parseFloat(value.replace(/[^0-9.]/g, '')) || 0;
    
    if (value.includes('K')) {
        return numericPart * 1000;
    } else if (value.includes('M')) {
        return numericPart * 1000000;
    } else if (value.includes('B')) {
        return numericPart * 1000000000;
    } else if (value.includes('T')) {
        return numericPart * 1000000000000;
    } else if (value.includes('Q')) {
        return numericPart * 1000000000000000;
    }
    
    return numericPart;
}

// Add value to score
function addToScore(valueStr) {
    const scoreValue = parseValueNotation(valueStr);
    config.score += scoreValue;
    scoreValueElement.textContent = formatLargeNumber(config.score);
}

// Format large number to include K, M, B, T, Q
function formatLargeNumber(num) {
    if (num >= 1000000000000000) {
        return (num / 1000000000000000).toFixed(1) + 'Q';
    } else if (num >= 1000000000000) {
        return (num / 1000000000000).toFixed(1) + 'T';
    } else if (num >= 1000000000) {
        return (num / 1000000000).toFixed(1) + 'B';
    } else if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
}

// Show winning animation
function showWinningAnimation(value, x, y) {
    const gameContainer = document.querySelector('.game-container');
    const rect = canvas.getBoundingClientRect();
    
    // Convert canvas coordinates to DOM coordinates
    const domX = rect.left + (x / canvas.width) * rect.width;
    const domY = rect.top + (y / canvas.height) * rect.height;
    
    const winDisplay = document.createElement('div');
    winDisplay.textContent = value;
    winDisplay.className = 'win-display';
    winDisplay.style.position = 'fixed';
    winDisplay.style.top = domY + 'px';
    winDisplay.style.left = domX + 'px';
    winDisplay.style.transform = 'translate(-50%, -50%)';
    winDisplay.style.fontSize = (1.5 * scale) + 'rem';
    winDisplay.style.fontWeight = 'bold';
    winDisplay.style.color = '#FFDE59';
    winDisplay.style.textShadow = '0 0 10px rgba(255, 222, 89, 0.8), 0 0 20px rgba(255, 222, 89, 0.5)';
    winDisplay.style.zIndex = '100';
    
    document.body.appendChild(winDisplay);
    
    // Animate and remove
    setTimeout(() => {
        winDisplay.style.opacity = '0';
        winDisplay.style.transform = 'translate(-50%, -150%)';
        setTimeout(() => {
            winDisplay.remove();
        }, 1000);
    }, 1000);
}

// Sound effects
function playBallDropSound() {
    if (!config.soundEnabled || !audioContext) return;
    const frequency = 400 + Math.random() * 100;
    playSound(frequency, 0.03, 'sine', 0.1);
}

function playPegHitSound(frequency) {
    if (!config.soundEnabled || !audioContext) return;
    playSound(frequency, 0.05, 'triangle', 0.08);
}

function playBucketSound(bucketIndex) {
    if (!config.soundEnabled || !audioContext) return;
    
    // Calculate how far from center the bucket is
    const middleIndex = Math.floor((config.rows - 1) / 2);
    const distFromCenter = Math.abs(bucketIndex - middleIndex);
    const isMiddle = distFromCenter === 0;
    const isAdjacent = distFromCenter === 1;
    
    // Sound intensity based on position
    let volume = 0.1;
    let intensity = 1;
    
    if (isMiddle) {
        // Center bucket - most intense sound
        volume = 0.3;
        intensity = 2;
    } else if (isAdjacent) {
        // Adjacent buckets - enhanced sound
        volume = 0.2;
        intensity = 1.5;
    }
    
    // Base frequency depends on position (lower/deeper sounds for center)
    const baseFreq = isMiddle ? 80 : isAdjacent ? 120 : 180;
    
    // Play sizzle sound with varying intensity
    playSizzleSound(baseFreq, volume, intensity);
}

function playSound(frequency, volume, type = 'sine', duration = 0.3) {
    if (!config.soundEnabled || !audioContext) return;
    
    try {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.type = type;
        oscillator.frequency.value = frequency;
        gainNode.gain.value = volume;
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.start();
        
        gainNode.gain.exponentialRampToValueAtTime(0.00001, audioContext.currentTime + duration);
        
        setTimeout(() => {
            oscillator.stop();
        }, duration * 1000);
    } catch (e) {
        console.warn('Error playing sound', e);
    }
}

function playSizzleSound(baseFreq, volume, intensity = 1) {
    if (!config.soundEnabled || !audioContext) return;
    
    try {
        // Create noise
        const bufferSize = 2 * audioContext.sampleRate;
        const noiseBuffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        
        for (let i = 0; i < bufferSize; i++) {
            output[i] = Math.random() * 2 - 1;
        }
        
        const noise = audioContext.createBufferSource();
        noise.buffer = noiseBuffer;
        
        // Create filter for sizzle effect
        const filter = audioContext.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = baseFreq;
        filter.Q.value = 1;
        
        // More intense filter for center buckets
        if (intensity > 1.3) {
            // Add a second filter for more character
            const filter2 = audioContext.createBiquadFilter();
            filter2.type = 'lowpass';
            filter2.frequency.value = baseFreq * 2;
            
            // Add distortion for intense center bucket sounds
            const distortion = audioContext.createWaveShaper();
            distortion.curve = makeDistortionCurve(intensity * 50);
            
            // Create gain for volume control
            const gainNode = audioContext.createGain();
            gainNode.gain.value = volume;
            
            // Connect nodes with distortion for intense sounds
            noise.connect(filter);
            filter.connect(filter2);
            filter2.connect(distortion);
            distortion.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            // More complex envelope for intense sounds
            const now = audioContext.currentTime;
            gainNode.gain.setValueAtTime(0, now);
            gainNode.gain.linearRampToValueAtTime(volume, now + 0.05);
            gainNode.gain.setValueAtTime(volume, now + 0.1);
            gainNode.gain.exponentialRampToValueAtTime(volume * 0.8, now + 0.2);
            gainNode.gain.exponentialRampToValueAtTime(0.00001, now + 0.7);
            
            // Start noise
            noise.start();
            
            // Stop after duration
            setTimeout(() => {
                noise.stop();
            }, 700);
        } else {
            // Create gain for volume control
            const gainNode = audioContext.createGain();
            gainNode.gain.value = volume;
            
            // Connect nodes
            noise.connect(filter);
            filter.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            // Start noise and ramp down volume
            noise.start();
            gainNode.gain.exponentialRampToValueAtTime(0.00001, audioContext.currentTime + 0.6);
            
            // Stop after duration
            setTimeout(() => {
                noise.stop();
            }, 600);
        }
    } catch (e) {
        console.warn('Error playing sizzle sound', e);
    }
}

// Creates a distortion curve for sound effects
function makeDistortionCurve(amount) {
    const k = typeof amount === 'number' ? amount : 50;
    const n_samples = 44100;
    const curve = new Float32Array(n_samples);
    const deg = Math.PI / 180;
    
    for (let i = 0; i < n_samples; ++i) {
        const x = i * 2 / n_samples - 1;
        curve[i] = (3 + k) * x * 20 * deg / (Math.PI + k * Math.abs(x));
    }
    
    return curve;
}

// Open bin editor
function openBinEditor(binIndex) {
    currentEditingBinIndex = binIndex;
    holeValueInput.value = config.holeValues[binIndex];
    
    holeEditor.classList.add('open');
    overlay.classList.add('open');
    
    holeValueInput.focus();
}

// Close bin editor
function closeBinEditor() {
    holeEditor.classList.remove('open');
    overlay.classList.remove('open');
    currentEditingBinIndex = -1;
}

// Save bin value
function saveBinValue() {
    if (currentEditingBinIndex >= 0) {
        const newValue = holeValueInput.value;
        config.holeValues[currentEditingBinIndex] = newValue;
    }
    closeBinEditor();
}

// Open peg editor
function openPegEditor(peg) {
    currentEditingPeg = peg;
    
    // Select the current peg color in the picker
    const colorOptions = document.querySelectorAll('#custom-peg-color-picker .color-option');
    colorOptions.forEach(option => {
        if (option.dataset.color === peg.color) {
            option.style.border = '2px solid white';
            customPegColor = peg.color;
        } else {
            option.style.border = '2px solid rgba(255, 255, 255, 0.2)';
        }
    });
    
    // Set the peg bounce value
    if (document.getElementById('peg-bounce-custom')) {
        document.getElementById('peg-bounce-custom').value = peg.bounciness;
    }
    
    // Show the editor
    pegEditor.classList.add('open');
    overlay.classList.add('open');
}

// Close peg editor
function closePegEditor() {
    pegEditor.classList.remove('open');
    overlay.classList.remove('open');
    currentEditingPeg = null;
}

// Save peg properties
function savePegProperties() {
    if (currentEditingPeg) {
        currentEditingPeg.color = customPegColor;
        const pegBounce = parseFloat(document.getElementById('peg-bounce-custom').value) || 1.0;
        currentEditingPeg.bounciness = pegBounce; 
        
        // Store custom properties in config
        config.customPegs[currentEditingPeg.id] = {
            color: customPegColor,
            bounciness: pegBounce
        };
    }
    closePegEditor();
}

// Check if click is near a bin divider or in a bin
function checkBinClick(x, y) {
    const clickThreshold = 15 * scale;
    
    // Check if click is near the bin line
    if (Math.abs(y - bins[0].y) > clickThreshold) {
        return -1;
    }
    
    // Find the bin area that was clicked
    for (let i = 0; i < bins.length - 1; i++) {
        if (x >= bins[i].x && x < bins[i+1].x) {
            return i;
        }
    }
    
    return -1;
}

// Check if click is on a peg
function checkPegClick(x, y) {
    const clickThreshold = 15 * scale;
    
    for (const peg of pegs) {
        const distance = Math.sqrt(Math.pow(x - peg.x, 2) + Math.pow(y - peg.y, 2));
        if (distance < peg.radius + clickThreshold) {
            return peg;
        }
    }
    
    return null;
}

// Draw the game
function drawGame() {
    // Clear canvas
    ctx.fillStyle = config.backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw pegs with glowing effect
    for (const peg of pegs) {
        // Draw glow
        const gradient = ctx.createRadialGradient(
            peg.x, peg.y, 0,
            peg.x, peg.y, peg.radius * 2
        );
        gradient.addColorStop(0, 'rgba(255, 255, 255, 0.3)');
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(peg.x, peg.y, peg.radius * 2, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw peg
        // If peg is flashing, use white, otherwise use its color
        ctx.fillStyle = peg.isFlashing ? '#FFFFFF' : peg.color;
        ctx.beginPath();
        ctx.arc(peg.x, peg.y, peg.radius, 0, Math.PI * 2);
        ctx.fill();
        
        // Reset flashing state
        if (peg.isFlashing) {
            setTimeout(() => {
                peg.isFlashing = false;
            }, 100);
        }
    }
    
    // Draw bins with borders and dividers
    ctx.strokeStyle = '#FF4D8D';
    ctx.lineWidth = 2 * scale;
    
    // Draw horizontal line at the bottom of the pegs
    ctx.beginPath();
    ctx.moveTo(0, bins[0].y);
    ctx.lineTo(canvas.width, bins[0].y);
    ctx.stroke();
    
    // Draw dividers and bin borders with vertical lines extending from bottom
    for (let i = 0; i < bins.length; i++) {
        const bin = bins[i];
        
        // Draw divider line - extend from bottom of canvas upward past bin line
        ctx.beginPath();
        ctx.moveTo(bin.x, canvas.height);
        ctx.lineTo(bin.x, bin.y - 20 * scale); // Extend slightly above the bin line
        ctx.stroke();
        
        // Draw bin border rectangles
        if (i < bins.length - 1) {
            // Draw a slightly lighter rectangle for each bin area
            ctx.fillStyle = 'rgba(255, 77, 141, 0.1)'; // Transparent pink
            ctx.fillRect(bin.x, bin.y, bins[i+1].x - bin.x, canvas.height - bin.y);
            
            // Draw border for bin area
            ctx.strokeStyle = 'rgba(255, 77, 141, 0.5)'; // Semi-transparent pink
            ctx.lineWidth = 1 * scale;
            ctx.strokeRect(bin.x, bin.y, bins[i+1].x - bin.x, canvas.height - bin.y);
            
            // Reset stroke style
            ctx.strokeStyle = '#FF4D8D';
            ctx.lineWidth = 2 * scale;
        }
    }
    
    // Draw bin values
    ctx.fillStyle = '#FFDE59'; // Bright yellow
    ctx.font = `bold ${14 * scale}px "Bangers", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    
    for (let i = 0; i < bins.length - 1; i++) {
        const midX = (bins[i].x + bins[i+1].x) / 2;
        
        // Add a small background for better visibility
        const valueText = config.holeValues[i];
        const textWidth = ctx.measureText(valueText).width;
        const textHeight = 14 * scale;
        const padding = 4 * scale;
        
        ctx.fillStyle = 'rgba(42, 18, 83, 0.7)'; // Semi-transparent deep purple
        ctx.fillRect(
            midX - textWidth/2 - padding, 
            bins[0].y - textHeight - padding*2, 
            textWidth + padding*2, 
            textHeight + padding
        );
        
        // Draw value text
        ctx.fillStyle = '#FFDE59';
        ctx.fillText(valueText, midX, bins[0].y - 5 * scale);
    }
    
    // Draw balls with Shiro icon
    drawBalls();
}

// Game loop
function gameLoop() {
    updateBalls();
    drawGame();
    animationId = requestAnimationFrame(gameLoop);
}

// Set up all event listeners
function setupEventListeners() {
    // Set up number input arrows
    setupNumberArrows();
    
    // Window resize handler
    window.addEventListener('resize', () => {
        resizeCanvas();
        createPegsAndBins();
    });
    
    // Multiplier buttons
    multiplierBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            // Update active state
            multiplierBtns.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            
            // Get requested multiplier
            const requestedMultiplier = parseInt(this.dataset.multiplier);
            
            // Use as many balls as we have left, up to the requested multiplier
            config.currentMultiplier = Math.min(requestedMultiplier, config.ballsRemaining);
            
            // Drop the balls
            dropMultipleBalls(config.currentMultiplier);
        });
    });
    
    // Edit config button
    editConfigBtn.addEventListener('click', () => {
        config.editMode = !config.editMode;
        configPanel.classList.toggle('open', config.editMode);
        editConfigBtn.classList.toggle('active', config.editMode);
        editConfigBtn.textContent = config.editMode ? 'Close Editor' : 'Edit Mode';
        
        // Update input values
        gameTitleInput.value = config.gameTitle;
        scorePrefixInput.value = config.scorePrefix;
        numRowsInput.value = config.rows;
        ballSizeInput.value = config.ballSize;
        pegSizeInput.value = config.pegSize;
        globalBounceInput.value = config.globalBounciness;
        maxBallsInput.value = config.maxBalls;
        binMultiplierInput.value = config.binMultiplier;
        
        // Set values for the peg editor as well
        if (document.getElementById('peg-bounce-custom')) {
            document.getElementById('peg-bounce-custom').value = config.globalBounciness;
        }
        
        // Select current color options
        document.querySelectorAll('#ball-color-picker .color-option').forEach(option => {
            if (option.dataset.color === config.ballColor) {
                option.style.border = '2px solid white';
            } else {
                option.style.border = '2px solid rgba(255, 255, 255, 0.2)';
            }
        });
        
        document.querySelectorAll('#peg-color-picker .color-option').forEach(option => {
            if (option.dataset.color === config.pegColor) {
                option.style.border = '2px solid white';
            } else {
                option.style.border = '2px solid rgba(255, 255, 255, 0.2)';
            }
        });
    });
    
    // Save config button
    saveConfigBtn.addEventListener('click', function() {
        console.log("Save config button clicked");
        
        // Ensure input values are within their allowed ranges
        numRowsInput.value = Math.max(Math.min(parseInt(numRowsInput.value) || 16, 16), 8);
        ballSizeInput.value = Math.max(Math.min(parseInt(ballSizeInput.value) || 10, 15), 5);
        pegSizeInput.value = Math.max(Math.min(parseInt(pegSizeInput.value) || 6, 10), 3);
        globalBounceInput.value = Math.max(Math.min(parseFloat(globalBounceInput.value) || 0.65, 1.5), 0.1);
        maxBallsInput.value = Math.max(Math.min(parseInt(maxBallsInput.value) || 50, 1000), 1);
        binMultiplierInput.value = Math.max(Math.min(parseInt(binMultiplierInput.value) || 1, 1000), 1);
        
        // Update peg bounce custom value to match global
        if (document.getElementById('peg-bounce-custom')) {
            document.getElementById('peg-bounce-custom').value = globalBounceInput.value;
        }
        
        // Update configuration
        config.gameTitle = gameTitleInput.value;
        config.scorePrefix = scorePrefixInput.value;
        config.rows = parseInt(numRowsInput.value) || 16;
        config.ballSize = parseInt(ballSizeInput.value) || 10;
        config.pegSize = parseInt(pegSizeInput.value) || 6;
        config.pegBounciness = parseFloat(globalBounceInput.value) || 0.65;
        config.maxBalls = parseInt(maxBallsInput.value) || 50;
        config.globalBounciness = parseFloat(globalBounceInput.value) || 0.65;
        config.binMultiplier = parseInt(binMultiplierInput.value) || 1;
        config.ballsRemaining = config.maxBalls; // Reset remaining balls to match max
        
        // Update physics settings
        config.physics.bounce = config.globalBounciness;
        
        // Apply bin multiplier
        applyBinMultiplier();
        
        // Ensure hole values array has the right length
        while (config.holeValues.length < config.rows) {
            config.holeValues.push('100B');
        }
        if (config.holeValues.length > config.rows) {
            config.holeValues = config.holeValues.slice(0, config.rows);
        }
        
        // Resize and update game
        resizeCanvas();
        createPegsAndBins();
        updateUI();
        
        // Reset edit mode
        config.editMode = false;
        configPanel.classList.remove('open');
        editConfigBtn.classList.remove('active');
        editConfigBtn.textContent = 'Edit Mode';
        
        console.log("Config saved, game updated");
    });
    
    // Cancel config button
    cancelConfigBtn.addEventListener('click', () => {
        config.editMode = false;
        configPanel.classList.remove('open');
        editConfigBtn.classList.remove('active');
        editConfigBtn.textContent = 'Edit Mode';
    });

    // Save bin value button
    saveHoleValueBtn.addEventListener('click', saveBinValue);
    
    // Cancel bin value button
    cancelHoleValueBtn.addEventListener('click', closeBinEditor);
    
    // Save peg properties button
    savePegPropertiesBtn.addEventListener('click', savePegProperties);
    
    // Cancel peg properties button
    cancelPegPropertiesBtn.addEventListener('click', closePegEditor);
    
    // Listen for Enter key in hole value input
    holeValueInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            saveBinValue();
        }
    });
    
    // Canvas click event for bin and peg editing
    canvas.addEventListener('click', function(e) {
        if (!config.editMode) return;
        
        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) * (canvas.width / rect.width);
        const y = (e.clientY - rect.top) * (canvas.height / rect.height);
        
        // Check for bin click
        const binIndex = checkBinClick(x, y);
        if (binIndex >= 0) {
            openBinEditor(binIndex);
            return;
        }
        
        // Check for peg click
        const peg = checkPegClick(x, y);
        if (peg) {
            openPegEditor(peg);
            return;
        }
    });
    
    // Reset button
    resetBtn.addEventListener('click', resetGame);
    
    // Play again button in final score overlay
    playAgainBtn.addEventListener('click', resetGame);
    
    // Sound toggle
    soundToggle.addEventListener('change', function() {
        config.soundEnabled = this.checked;
    });
    
    // Set up color pickers
    setupColorPickers();
    
    // Add event listeners for continuous drop on x1 button
    const dropBtn = document.querySelector('.multiplier-btn[data-multiplier="1"]');
    
    const handleDropStart = (e) => {
        e.preventDefault();
        startContinuousDrop();
    };
    
    const handleDropEnd = (e) => {
        if (e) e.preventDefault();
        stopContinuousDrop();
    };
    
    // Mouse events
    dropBtn.addEventListener('mousedown', handleDropStart);
    dropBtn.addEventListener('mouseup', handleDropEnd);
    dropBtn.addEventListener('mouseleave', handleDropEnd);
    
    // Touch events
    dropBtn.addEventListener('touchstart', handleDropStart, { passive: false });
    dropBtn.addEventListener('touchend', handleDropEnd, { passive: false });
    dropBtn.addEventListener('touchcancel', handleDropEnd, { passive: false });
    
    // Handle resume of audio context on first interaction
    document.body.addEventListener('click', function initAudioOnInteraction() {
        if (audioContext && audioContext.state === 'suspended') {
            audioContext.resume();
        }
        document.body.removeEventListener('click', initAudioOnInteraction);
    }, { once: true });
    
    // Set default active multiplier
    document.querySelector('.multiplier-btn[data-multiplier="1"]').classList.add('active');
}

// Add decorative elements for the Shiro theme
function addDecorativeElements() {
    // Add background-color picker event listeners
    setupBackgroundColorPicker();
}

// Set up color pickers for ball and peg
function setupColorPickers() {
    // Ball color picker
    document.querySelectorAll('#ball-color-picker .color-option').forEach(option => {
        option.addEventListener('click', function() {
            const color = this.dataset.color;
            config.ballColor = color;
            
            // Visual feedback
            document.querySelectorAll('#ball-color-picker .color-option').forEach(o => {
                o.style.border = '2px solid rgba(255, 255, 255, 0.2)';
            });
            this.style.border = '2px solid white';
        });
    });
    
    // Default peg color picker
    document.querySelectorAll('#peg-color-picker .color-option').forEach(option => {
        option.addEventListener('click', function() {
            const color = this.dataset.color;
            config.pegColor = color;
            
            // Visual feedback
            document.querySelectorAll('#peg-color-picker .color-option').forEach(o => {
                o.style.border = '2px solid rgba(255, 255, 255, 0.2)';
            });
            this.style.border = '2px solid white';
        });
    });
    
    // Custom peg color picker in peg editor
    document.querySelectorAll('#custom-peg-color-picker .color-option').forEach(option => {
        option.addEventListener('click', function() {
            customPegColor = this.dataset.color;
            
            // Visual feedback
            document.querySelectorAll('#custom-peg-color-picker .color-option').forEach(o => {
                o.style.border = '2px solid rgba(255, 255, 255, 0.2)';
            });
            this.style.border = '2px solid white';
        });
    });
    
    // Select the current color options
    document.querySelectorAll('#ball-color-picker .color-option').forEach(option => {
        if (option.dataset.color === config.ballColor) {
            option.style.border = '2px solid white';
        }
    });
    
    document.querySelectorAll('#peg-color-picker .color-option').forEach(option => {
        if (option.dataset.color === config.pegColor) {
            option.style.border = '2px solid white';
        }
    });
    
    document.querySelectorAll('#background-color-picker .color-option').forEach(option => {
        if (option.dataset.color === config.backgroundColor) {
            option.style.border = '2px solid white';
        }
    });
}

// Start a continuous drop of balls with mouse/touch hold
function startContinuousDrop() {
    if (dropInterval || config.ballsRemaining <= 0) return;
    
    // Resume AudioContext if suspended
    if (audioContext && audioContext.state === 'suspended') {
        audioContext.resume();
    }
    
    dropBall(); // Drop first ball immediately
    
    dropInterval = setInterval(() => {
        if (config.ballsRemaining > 0) {
            dropBall();
        } else {
            stopContinuousDrop();
        }
    }, 200);
}

function stopContinuousDrop() {
    if (dropInterval) {
        clearInterval(dropInterval);
        dropInterval = null;
    }
}

// Setup number input arrows
function setupNumberArrows() {
    // Handle up arrow clicks
    document.querySelectorAll('.arrow-up').forEach(arrow => {
        arrow.addEventListener('click', function() {
            const inputId = this.dataset.input;
            const input = document.getElementById(inputId);
            if (!input) return;
            
            // Get current value and step
            let value = parseFloat(input.value) || 0;
            const step = parseFloat(input.step) || 1;
            const max = parseFloat(input.max);
            
            // Increment by 1 step
            value += step;
            
            // Check maximum
            if (!isNaN(max) && value > max) {
                value = max;
            }
            
            // Update input
            input.value = value;
            // Trigger change event
            const event = new Event('change', { bubbles: true });
            input.dispatchEvent(event);
        });
    });
    
    // Handle down arrow clicks
    document.querySelectorAll('.arrow-down').forEach(arrow => {
        arrow.addEventListener('click', function() {
            const inputId = this.dataset.input;
            const input = document.getElementById(inputId);
            if (!input) return;
            
            // Get current value and step
            let value = parseFloat(input.value) || 0;
            const step = parseFloat(input.step) || 1;
            const min = parseFloat(input.min);
            
            // Decrement by 1 step
            value -= step;
            
            // Check minimum
            if (!isNaN(min) && value < min) {
                value = min;
            }
            
            // Update input
            input.value = value;
            // Trigger change event
            const event = new Event('change', { bubbles: true });
            input.dispatchEvent(event);
        });
    });
}

// Initialize the game on page load
document.addEventListener('DOMContentLoaded', initGame);
