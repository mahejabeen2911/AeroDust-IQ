// AeroDust-IQ Optimization & Simulation Engine

// Constants
const TOTAL_DISTANCE = 28.0; // km
const BASELINE_CD = 0.65;
const OPTIMIZED_CD_MIN = 0.48;
const MAX_WATER_CAPACITY = 150.0; // Liters
const UPDATE_INTERVAL = 100; // ms per tick

// Route Waypoint Data
const waypoints = [
    { name: "Bhilai Steel Plant", km: 0.0, baseAqi: 145, silt: 15.0, speedLimit: 30, road: "plant_haul" },
    { name: "Power House", km: 5.6, baseAqi: 160, silt: 4.5, speedLimit: 40, road: "highway_paved" },
    { name: "Charoda Highway", km: 11.2, baseAqi: 120, silt: 3.0, speedLimit: 60, road: "highway_paved" },
    { name: "Kumhari Bypass", km: 16.8, baseAqi: 220, silt: 12.0, speedLimit: 50, road: "bypass_dusty" },
    { name: "Tatibandh Chowk", km: 22.4, baseAqi: 260, silt: 15.0, speedLimit: 35, road: "bypass_dusty" },
    { name: "Urla Ind. Area", km: 28.0, baseAqi: 290, silt: 22.0, speedLimit: 30, road: "industrial_unpaved" }
];

// App State
let simState = {
    isRunning: false,
    speed: 45, // km/h
    cargoType: "coal", // coal, flyash, ironore, sand
    roadCondition: "bypass_dusty", // select element choice
    season: "winter", // winter, summer, monsoon
    enableAero: true,
    enableMist: true,
    enableCover: true,
    distanceTravelled: 0.0,
    waterRemaining: 150.0, // Liters
    accumulatedFuelSaved: 0.0, // Liters
    accumulatedCargoSaved: 0.0, // kg
    accumulatedStdPM: 0.0, // kg total
    accumulatedOptPM: 0.0, // kg total
    currentWaypointIndex: 0,
    timerId: null,
    timeStep: 0.03, // hours simulated per tick / multiplier
};

// SVG Elements
const svgFlapTop = document.getElementById("flap-top");
const svgFlapBottom = document.getElementById("flap-bottom");
const svgMistSpray = document.getElementById("mist-spray");
const svgDustCloud = document.getElementById("dust-cloud");
const svgTarp = document.getElementById("cargo-tarp");
const svgCargo = document.getElementById("cargo-material");
const roadLinesGroup = document.getElementById("road-lines");
const wheelGroup = document.querySelectorAll(".wheel-group circle");

// Input Elements
const toggleAero = document.getElementById("toggle-aero");
const toggleMist = document.getElementById("toggle-mist");
const toggleCover = document.getElementById("toggle-cover");
const inputSpeed = document.getElementById("input-speed");
const inputRoad = document.getElementById("input-road");
const valSpeed = document.getElementById("val-speed");

// Metrics Readout Elements
const readCd = document.getElementById("val-cd");
const readMistFlow = document.getElementById("val-flow");
const readStdPm = document.getElementById("metric-std-pm");
const readOptPm = document.getElementById("metric-opt-pm");
const readWater = document.getElementById("metric-water");
const waterBar = document.getElementById("water-bar");
const readFuel = document.getElementById("metric-fuel");
const readCargo = document.getElementById("metric-cargo");
const readReduction = document.getElementById("metric-reduction");
const routeProgressText = document.getElementById("route-progress");
const progressBar = document.getElementById("progress-bar");
const systemStatus = document.getElementById("system-status");

// Controls buttons
const btnPlay = document.getElementById("btn-play");
const btnReset = document.getElementById("btn-reset");

// Charts
let emissionChart = null;
let cumulativeChart = null;
let chartTimeLabels = [];
let chartStdData = [];
let chartOptData = [];

// Initialize Dashboard
document.addEventListener("DOMContentLoaded", () => {
    initCharts();
    setupListeners();
    updateDashboardUI();
});

// Setup Chart.js Graphs
function initCharts() {
    const ctx1 = document.getElementById("emissionChart").getContext("2d");
    emissionChart = new Chart(ctx1, {
        type: 'line',
        data: {
            labels: chartTimeLabels,
            datasets: [
                {
                    label: 'Standard PM10 (kg/km)',
                    data: chartStdData,
                    borderColor: '#f43f5e',
                    backgroundColor: 'rgba(244, 63, 94, 0.1)',
                    borderWidth: 2,
                    tension: 0.3,
                    fill: true
                },
                {
                    label: 'Optimized PM10 (kg/km)',
                    data: chartOptData,
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    borderWidth: 2.5,
                    tension: 0.3,
                    fill: true
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: { display: true, text: 'Real-Time Tailgate PM10 Emission Factor', color: '#f8fafc' },
                legend: { labels: { color: '#94a3b8' } }
            },
            scales: {
                x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#64748b' } },
                y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#64748b' }, min: 0 }
            }
        }
    });

    const ctx2 = document.getElementById("cumulativeChart").getContext("2d");
    cumulativeChart = new Chart(ctx2, {
        type: 'bar',
        data: {
            labels: ['Cumulative PM10 Emitted (kg)'],
            datasets: [
                {
                    label: 'Standard Dumper',
                    data: [0],
                    backgroundColor: '#f43f5e',
                    borderRadius: 6
                },
                {
                    label: 'AeroDust-IQ Optimized',
                    data: [0],
                    backgroundColor: '#10b981',
                    borderRadius: 6
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: { display: true, text: 'Corridor Dust Footprint Comparison', color: '#f8fafc' },
                legend: { labels: { color: '#94a3b8' } }
            },
            scales: {
                y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#64748b' }, min: 0 }
            }
        }
    });
}

// Attach event handlers
function setupListeners() {
    // Toggles
    toggleAero.addEventListener("change", (e) => { simState.enableAero = e.target.checked; updateSimulationPhysics(); });
    toggleMist.addEventListener("change", (e) => { simState.enableMist = e.target.checked; updateSimulationPhysics(); });
    toggleCover.addEventListener("change", (e) => { simState.enableCover = e.target.checked; updateSimulationPhysics(); });

    // Speed Slider
    inputSpeed.addEventListener("input", (e) => {
        simState.speed = parseInt(e.target.value);
        valSpeed.innerText = `${simState.speed} km/h`;
        updateSimulationPhysics();
    });

    // Road Condition Selector
    inputRoad.addEventListener("change", (e) => {
        simState.roadCondition = e.target.value;
        updateSimulationPhysics();
    });

    // Preset Buttons
    document.querySelectorAll(".btn-preset").forEach(btn => {
        btn.addEventListener("click", (e) => {
            document.querySelectorAll(".btn-preset").forEach(b => b.classList.remove("active"));
            const targetBtn = e.currentTarget;
            targetBtn.classList.add("active");
            simState.season = targetBtn.dataset.preset;
            updateSimulationPhysics();
        });
    });

    // Cargo Radios
    document.getElementsByName("cargo").forEach(radio => {
        radio.addEventListener("change", (e) => {
            if (e.target.checked) {
                simState.cargoType = e.target.value;
                updateCargoColor();
                updateSimulationPhysics();
            }
        });
    });

    // Control buttons
    btnPlay.addEventListener("click", toggleSimulation);
    btnReset.addEventListener("click", resetSimulation);
}

// Change color of cargo inside SVG according to material selected
function updateCargoColor() {
    let color = "#2b2d31"; // Coal default
    switch(simState.cargoType) {
        case "coal": color = "#1e293b"; break;
        case "flyash": color = "#94a3b8"; break;
        case "ironore": color = "#7f1d1d"; break;
        case "sand": color = "#b45309"; break;
    }
    svgCargo.setAttribute("fill", color);
}

// UI State Updater
function updateDashboardUI() {
    // Tarpaulin visibility
    if (simState.enableCover) {
        svgTarp.style.display = "block";
    } else {
        svgTarp.style.display = "none";
    }

    // Wheel rotation speed animation
    const degSpeed = simState.speed > 0 ? (20 / simState.speed) : 0;
    wheelGroup.forEach(wheel => {
        if (simState.speed > 0) {
            wheel.style.animation = `rotateWind ${degSpeed}s linear infinite`;
        } else {
            wheel.style.animation = "none";
        }
    });

    // Active status styling
    if (simState.enableAero || (simState.enableMist && simState.waterRemaining > 0) || simState.enableCover) {
        systemStatus.innerText = "System Active";
        systemStatus.className = "status-indicator live";
    } else {
        systemStatus.innerText = "System Bypass";
        systemStatus.className = "status-indicator";
        systemStatus.style.background = "rgba(244, 63, 94, 0.15)";
        systemStatus.style.color = "var(--danger)";
        systemStatus.style.borderColor = "var(--danger)";
        systemStatus.style.boxShadow = "none";
    }
}

// Calculate the Physics of Dust, Drag, Fuel and Water Consumption
function calculatePhysics() {
    // 1. Road silt coefficients
    let siltLoad = 5.0; // g/m2 paved or % silt unpaved
    let isPaved = true;
    switch(simState.roadCondition) {
        case "highway_paved": siltLoad = 2.0; isPaved = true; break;
        case "bypass_dusty": siltLoad = 12.0; isPaved = true; break;
        case "plant_haul": siltLoad = 15.0; isPaved = false; break;
        case "industrial_unpaved": siltLoad = 22.0; isPaved = false; break;
    }

    // Season Multipliers
    let seasonMultiplier = 1.0;
    if (simState.season === "winter") seasonMultiplier = 1.25; // dry cold
    if (simState.season === "monsoon") seasonMultiplier = 0.12; // wet damp
    if (simState.season === "summer") seasonMultiplier = 1.0;

    // 2. Base Road Dust (AP-42 model)
    let pmBase = 0.0;
    if (isPaved) {
        // Paved road dust PM10 (kg/km) ~ k * (sL)^0.91 * (W)^1.02
        // For standard 30 ton dumper
        pmBase = 0.05 * Math.pow(siltLoad, 0.91) * Math.pow(30, 0.4);
    } else {
        // Unpaved road dust PM10 (kg/km) ~ k * (s/12)^a * (W/3)^b
        pmBase = 0.45 * Math.pow(siltLoad / 12, 0.9) * Math.pow(30 / 3, 0.45);
    }
    
    // Scale base dust with speed (faster vehicles lift more dust)
    let speedFactor = simState.speed > 0 ? Math.pow(simState.speed / 45, 1.25) : 0;
    let pmRoadDust = pmBase * speedFactor * seasonMultiplier;

    // 3. Cargo Wind Spillage
    let cargoBaseSpill = 0.15; // kg/km default
    switch(simState.cargoType) {
        case "coal": cargoBaseSpill = 0.20; break;
        case "flyash": cargoBaseSpill = 0.35; break; // very fine, easily blown
        case "ironore": cargoBaseSpill = 0.08; break; // heavy minerals
        case "sand": cargoBaseSpill = 0.15; break;
    }
    
    // Cargo spillage scales quadratically with speed
    let cargoSpillageRaw = simState.speed > 0 ? (cargoBaseSpill * Math.pow(simState.speed / 50, 2)) : 0;
    let finalCargoSpillage = simState.enableCover ? (cargoSpillageRaw * 0.027) : cargoSpillageRaw; // 97.3% saved with tarp

    // 4. Aerodynamics Flaps & Drag reduction
    let dragCd = BASELINE_CD;
    let flapAngle = 0;
    let wakeReductionFactor = 1.0;
    
    if (simState.enableAero && simState.speed >= 25) {
        // Flaps deploy proportionally up to 45km/h, lock at 20 degrees
        flapAngle = Math.min(20, 5 + (simState.speed - 25) * 0.75);
        // Drag coefficient scales down with angle
        dragCd = BASELINE_CD - ((BASELINE_CD - OPTIMIZED_CD_MIN) * (flapAngle / 20));
        // Wake drag reduction weakens the ground suction vortex (reduces lift by 42% at max angle)
        wakeReductionFactor = 1.0 - (0.42 * (flapAngle / 20));
    }

    let pmRoadDustWakeModified = pmRoadDust * wakeReductionFactor;

    // 5. Smart Misting Suppression
    let mistFlowRate = 0.0; // L/min
    let pmCaptureEfficiency = 0.0;

    if (simState.enableMist && simState.waterRemaining > 0 && simState.speed > 10) {
        // Spray intensity adjusts dynamically to speed and dust level
        let relativeDustiness = pmRoadDustWakeModified / 1.5;
        mistFlowRate = 0.5 + Math.min(2.5, relativeDustiness * 2.0); // max 3.0 L/min
        
        // PM capture efficiency is 82% when mist is fully operational
        pmCaptureEfficiency = 0.82;
    }

    // 6. Net PM10 Outflow Calculations (kg/km)
    let stdPM10 = pmRoadDust + cargoSpillageRaw; // No intervention
    
    let optPM10 = (pmRoadDustWakeModified * (1 - pmCaptureEfficiency)) + finalCargoSpillage;
    if (simState.speed === 0) {
        stdPM10 = 0;
        optPM10 = 0;
    }

    // 7. Water usage (Liters per hour or km)
    // mistFlowRate is L/min. To find L/km: flowRate / speed_km_min
    let speed_km_min = simState.speed / 60;
    let waterUsagePerKm = speed_km_min > 0 ? (mistFlowRate / speed_km_min) : 0; // L/km

    // 8. Fuel Saved (due to drag reduction)
    // Fuel saved scales with drag reduction and cube of speed (aerodynamic power)
    let fuelSavedPerKm = 0.0;
    if (simState.speed > 30) {
        const cdDiff = BASELINE_CD - dragCd;
        fuelSavedPerKm = 0.045 * cdDiff * Math.pow(simState.speed / 50, 1.8); // Liters saved per km
    }

    // 9. Cargo Saved (kg/km)
    let cargoSavedPerKm = cargoSpillageRaw - finalCargoSpillage;

    return {
        stdPM10,
        optPM10,
        dragCd,
        flapAngle,
        mistFlowRate,
        waterUsagePerKm,
        fuelSavedPerKm,
        cargoSavedPerKm,
        pmCaptureEfficiency
    };
}

// Update simulation stats and SVG animations in real-time
function updateSimulationPhysics() {
    const phys = calculatePhysics();

    // Update screen text
    readCd.innerText = phys.dragCd.toFixed(2);
    readMistFlow.innerText = `${phys.mistFlowRate.toFixed(1)} L/min`;
    readStdPm.innerHTML = `${phys.stdPM10.toFixed(2)} <span class="unit">kg/km</span>`;
    readOptPm.innerHTML = `${phys.optPM10.toFixed(2)} <span class="unit">kg/km</span>`;

    const reductionPercent = phys.stdPM10 > 0 ? (((phys.stdPM10 - phys.optPM10) / phys.stdPM10) * 100) : 0.0;
    readReduction.innerText = `-${reductionPercent.toFixed(1)}%`;

    // SVG updates
    // A. Adjust Flap Angles in SVG (rotate)
    if (simState.enableAero && simState.speed >= 25) {
        svgFlapTop.setAttribute("transform", `rotate(${-phys.flapAngle}, 0, 0)`);
        svgFlapBottom.setAttribute("transform", `rotate(${phys.flapAngle}, 0, 115)`);
    } else {
        svgFlapTop.removeAttribute("transform");
        svgFlapBottom.removeAttribute("transform");
    }

    // B. Misting Spray opacity & scale
    if (phys.mistFlowRate > 0) {
        svgMistSpray.style.display = "block";
        svgMistSpray.setAttribute("opacity", (phys.mistFlowRate / 3.0) * 0.7);
    } else {
        svgMistSpray.style.display = "none";
    }

    // C. Aerodynamic Streamline swap (clean green vs turbulent red)
    const cleanLines = document.querySelectorAll(".streamlined");
    const turbulentLines = document.querySelectorAll(".turbulent");
    if (simState.enableAero && simState.speed >= 25) {
        cleanLines.forEach(l => l.style.display = "block");
        turbulentLines.forEach(l => l.style.display = "none");
    } else {
        cleanLines.forEach(l => l.style.display = "none");
        turbulentLines.forEach(l => l.style.display = "block");
    }

    // D. Dust Cloud Behind Vehicle
    // Calculate dust density based on PM outflow
    const relativeDustDensity = Math.min(1.0, phys.optPM10 / 1.8);
    const dustCloudContainer = document.getElementById("dust-cloud-container");
    
    // Clear out old particles
    dustCloudContainer.innerHTML = "";
    
    // Create new animated dust puffs based on density and speed
    if (simState.speed > 10 && relativeDustDensity > 0.05) {
        const particleCount = Math.floor(relativeDustDensity * 12);
        for (let i = 0; i < particleCount; i++) {
            const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            const cy = 250 + Math.random() * 40;
            const cx = 110 - Math.random() * 30;
            const r = 10 + Math.random() * 30 * relativeDustDensity;
            
            circle.setAttribute("cx", cx);
            circle.setAttribute("cy", cy);
            circle.setAttribute("r", r);
            circle.setAttribute("fill", `rgba(180, 150, 130, ${0.15 + Math.random() * 0.3})`);
            circle.classList.add("dust-particle");
            
            // Randomize animation delays and durations
            const delay = Math.random() * 1.5;
            const duration = 0.8 + Math.random() * 1.0;
            circle.style.animation = `billowDust ${duration}s ease-out infinite`;
            circle.style.animationDelay = `${delay}s`;
            
            dustCloudContainer.appendChild(circle);
        }
    }

    updateDashboardUI();
}

// Tick update loop representing vehicle movement
function simTick() {
    if (!simState.isRunning) return;

    // Tick increment distance: speed_km_hr * time_elapsed_hr
    // UPDATE_INTERVAL is 100ms. Scale factor 0.03 for visual simulation acceleration.
    const timeStepHours = (UPDATE_INTERVAL / 3600000) * 120; // Accelerated time
    const distDelta = simState.speed * timeStepHours;
    
    simState.distanceTravelled += distDelta;

    if (simState.distanceTravelled >= TOTAL_DISTANCE) {
        simState.distanceTravelled = TOTAL_DISTANCE;
        toggleSimulation(); // stop
        alert("Trip Complete! Heavy dumper has safely reached Urla Industrial Area, Raipur with optimized emissions.");
    }

    // Dynamic Route Waypoints checks
    updateRouteTracking();

    // Retrieve active physics values
    const phys = calculatePhysics();

    // Decrement water tank
    if (phys.mistFlowRate > 0) {
        const waterUsed = (phys.mistFlowRate / 60) * (UPDATE_INTERVAL / 1000) * 120; // adjusted for simulation speed
        simState.waterRemaining = Math.max(0.0, simState.waterRemaining - waterUsed);
    }
    
    // Accumulate total metrics
    simState.accumulatedFuelSaved += phys.fuelSavedPerKm * distDelta;
    simState.accumulatedCargoSaved += phys.cargoSavedPerKm * distDelta;
    simState.accumulatedStdPM += phys.stdPM10 * distDelta;
    simState.accumulatedOptPM += phys.optPM10 * distDelta;

    // Update charts and dashboard readouts
    updateAccumulatedMetrics(phys);
}

// Sync route nodes and environment dynamically based on distance travelled
function updateRouteTracking() {
    // Determine current waypoint segment
    let idx = 0;
    for (let i = 0; i < waypoints.length; i++) {
        if (simState.distanceTravelled >= waypoints[i].km) {
            idx = i;
        }
    }

    if (idx !== simState.currentWaypointIndex) {
        simState.currentWaypointIndex = idx;
        const currentWp = waypoints[idx];

        // Apply waypoint automatic changes (simulating smart road adjustments)
        simState.roadCondition = currentWp.road;
        inputRoad.value = currentWp.road;
        
        // Adjust speed slider to speed limits
        simState.speed = currentWp.speedLimit;
        inputSpeed.value = currentWp.speedLimit;
        valSpeed.innerText = `${simState.speed} km/h`;

        // Update UI waypoint highlights
        const waypointNodes = document.querySelectorAll(".waypoint");
        waypointNodes.forEach((node, i) => {
            if (i < idx) {
                node.className = "waypoint passed";
            } else if (i === idx) {
                node.className = "waypoint active";
            } else {
                node.className = "waypoint";
            }
        });
    }

    // Smooth progress bar update
    const percent = (simState.distanceTravelled / TOTAL_DISTANCE) * 100;
    progressBar.style.width = `${percent}%`;
    routeProgressText.innerText = `${simState.distanceTravelled.toFixed(1)} / ${TOTAL_DISTANCE} km`;
}

// Display accumulated savings
function updateAccumulatedMetrics(phys) {
    // Water text
    const waterPercent = (simState.waterRemaining / MAX_WATER_CAPACITY) * 100;
    readWater.innerText = `${waterPercent.toFixed(0)}%`;
    waterBar.style.width = `${waterPercent}%`;
    if (waterPercent <= 15) {
        waterBar.style.backgroundColor = "var(--danger)";
    } else {
        waterBar.style.backgroundColor = "var(--primary)";
    }

    // Fuel and Cargo texts
    readFuel.innerHTML = `${simState.accumulatedFuelSaved.toFixed(1)} <span class="unit">L</span>`;
    readCargo.innerHTML = `${simState.accumulatedCargoSaved.toFixed(1)} <span class="unit">kg</span>`;

    // Dynamic Chart Update on Trip
    const label = `${simState.distanceTravelled.toFixed(1)} km`;
    if (chartTimeLabels.length === 0 || chartTimeLabels[chartTimeLabels.length - 1] !== label) {
        chartTimeLabels.push(label);
        chartStdData.push(phys.stdPM10);
        chartOptData.push(phys.optPM10);

        // Keep last 15 points for legibility
        if (chartTimeLabels.length > 15) {
            chartTimeLabels.shift();
            chartStdData.shift();
            chartOptData.shift();
        }
        
        emissionChart.update('none'); // silent update
    }

    // Bar chart update (Total cumulative)
    cumulativeChart.data.datasets[0].data = [simState.accumulatedStdPM];
    cumulativeChart.data.datasets[1].data = [simState.accumulatedOptPM];
    cumulativeChart.update('none');

    updateSimulationPhysics();
}

// Play / Pause Toggle
function toggleSimulation() {
    if (simState.isRunning) {
        simState.isRunning = false;
        clearInterval(simState.timerId);
        btnPlay.innerHTML = '<i class="fa-solid fa-play"></i> Start Route Run';
        btnPlay.className = "btn btn-primary btn-block";
        document.getElementById("truck-svg").classList.remove("running");
    } else {
        simState.isRunning = true;
        simState.timerId = setInterval(simTick, UPDATE_INTERVAL);
        btnPlay.innerHTML = '<i class="fa-solid fa-pause"></i> Pause Route Run';
        btnPlay.className = "btn btn-preset active btn-block";
        document.getElementById("truck-svg").classList.add("running");
    }
}

// Reset entire simulation state
function resetSimulation() {
    if (simState.isRunning) {
        toggleSimulation();
    }
    
    simState.distanceTravelled = 0.0;
    simState.waterRemaining = MAX_WATER_CAPACITY;
    simState.accumulatedFuelSaved = 0.0;
    simState.accumulatedCargoSaved = 0.0;
    simState.accumulatedStdPM = 0.0;
    simState.accumulatedOptPM = 0.0;
    simState.currentWaypointIndex = 0;
    
    // Clear charts
    chartTimeLabels.length = 0;
    chartStdData.length = 0;
    chartOptData.length = 0;
    
    emissionChart.update();
    cumulativeChart.data.datasets[0].data = [0];
    cumulativeChart.data.datasets[1].data = [0];
    cumulativeChart.update();

    // Reset waypoints classes
    const waypointNodes = document.querySelectorAll(".waypoint");
    waypointNodes.forEach((node, i) => {
        if (i === 0) node.className = "waypoint active";
        else node.className = "waypoint";
    });

    progressBar.style.width = "0%";
    routeProgressText.innerText = `0.0 / ${TOTAL_DISTANCE} km`;

    // Apply values
    simState.roadCondition = "bypass_dusty";
    inputRoad.value = "bypass_dusty";
    simState.speed = 45;
    inputSpeed.value = 45;
    valSpeed.innerText = "45 km/h";

    updateSimulationPhysics();
}

// Tab Switching System
function switchTab(tabId) {
    // Switch active buttons
    document.querySelectorAll(".tab-btn").forEach(btn => btn.classList.remove("active"));
    if (tabId === "simulator") {
        document.getElementById("tab-btn-sim").classList.add("active");
    } else {
        document.getElementById("tab-btn-exp").classList.add("active");
    }

    // Switch active tab content
    document.querySelectorAll(".tab-content").forEach(content => content.classList.remove("active"));
    document.getElementById(`tab-${tabId}`).classList.add("active");
}

// Slide Control System
let currentSlide = 1;
const TOTAL_SLIDES = 5;

function changeSlide(direction) {
    let target = currentSlide + direction;
    if (target >= 1 && target <= TOTAL_SLIDES) {
        goDirectToSlide(target);
    }
}

function goDirectToSlide(slideNum) {
    currentSlide = slideNum;

    // Toggle active slide
    document.querySelectorAll(".explainer-slide").forEach(slide => slide.classList.remove("active"));
    document.getElementById(`slide-${slideNum}`).classList.add("active");

    // Toggle active dot
    const dots = document.querySelectorAll(".dot");
    dots.forEach((dot, idx) => {
        if (idx === slideNum - 1) {
            dot.classList.add("active");
        } else {
            dot.classList.remove("active");
        }
    });

    // Toggle Prev/Next buttons disabled state
    const btnPrev = document.getElementById("btn-prev-slide");
    const btnNext = document.getElementById("btn-next-slide");

    btnPrev.disabled = (slideNum === 1);
    btnNext.disabled = (slideNum === TOTAL_SLIDES);
}

