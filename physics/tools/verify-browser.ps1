# ============================================================
#  Browser-level verification for the PHYSICS study site.
#  Renders every route with headless Edge/Chrome, saves the DOM to
#  tools\_dom\*.html, then runs verify-dom.mjs to assert on it.
#
#  Usage:
#    powershell -File tools\verify-browser.ps1              # render every route
#    powershell -File tools\verify-browser.ps1 -Only w3     # only routes whose name contains "w3"
#
#  NOTE: this file is intentionally 100% ASCII. Windows PowerShell 5.1
#  reads .ps1 files as ANSI unless they carry a UTF-8 BOM, so Chinese
#  text here would get mangled and break parsing (see start-physics.cmd
#  for the same convention, and physics\README.md for Chinese docs).
# ============================================================
param([string]$Only = "")
$ErrorActionPreference = 'Continue'
$base = Split-Path -Parent $PSScriptRoot
$candidates = @(
  "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
  "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
  "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
)
$browser = $null
foreach ($c in $candidates) { if (Test-Path $c) { $browser = $c; break } }
if (-not $browser) { Write-Output "[ERROR] Edge or Chrome not found."; exit 1 }
Write-Output ("Using browser: " + $browser)

$domDir = Join-Path $base "tools\_dom"
if (-not (Test-Path $domDir)) { New-Item -ItemType Directory -Path $domDir | Out-Null }
# A full run starts from a clean slate: renamed or removed routes would otherwise
# leave stale snapshots behind, and verify-dom.mjs globs lesson-*.html from disk.
if ($Only -eq "") {
  Get-ChildItem -Path $domDir -Filter *.html -File | Remove-Item -Force
  Write-Output "  cleared stale snapshots in tools\_dom"
}
$profileDir = Join-Path $base ".edge-profile"
$urlBase = "file:///" + ($base -replace '\\', '/') + "/index.html#"

$routes = [ordered]@{
  # --- non-lesson pages ---
  "home"            = "/"
  "path"            = "/path"
  "formulas"        = "/formulas"
  "cards"           = "/cards"
  "glossary"        = "/glossary"
  "roadmap"         = "/roadmap"
  "notebook"        = "/notebook"
  "review"          = "/review"
  # --- course pages ---
  "course-zero"     = "/c/physics-zero-basics"
  "course-mech"     = "/c/mechanics"
  "course-thermal"  = "/c/thermal-physics"
  "course-em"       = "/c/electromagnetism"
  "course-optics"   = "/c/optics"
  "course-atom"     = "/c/atomic-physics"
  # --- W1: zero-basics (5 lessons) ---
  "lesson-pz1"      = "/c/physics-zero-basics/pz-what-is-physics"
  "lesson-pz2"      = "/c/physics-zero-basics/pz-units-si"
  "lesson-pz3"      = "/c/physics-zero-basics/pz-dimension-analysis"
  "lesson-pz4"      = "/c/physics-zero-basics/pz-graphs"
  "lesson-pz5"      = "/c/physics-zero-basics/pz-error-measurement"
  # --- W1: mechanics (7 lessons) ---
  "lesson-mech1"    = "/c/mechanics/mech-kinematics"
  "lesson-mech2"    = "/c/mechanics/mech-newton-laws"
  "lesson-mech3"    = "/c/mechanics/mech-momentum-collision"
  "lesson-mech4"    = "/c/mechanics/mech-work-energy"
  "lesson-mech5"    = "/c/mechanics/mech-rotation"
  "lesson-mech6"    = "/c/mechanics/mech-oscillation"
  "lesson-mech7"    = "/c/mechanics/mech-gravitation"
  # --- W2: thermal physics (5 lessons) ---
  "lesson-th1"      = "/c/thermal-physics/th-temperature-state"
  "lesson-th2"      = "/c/thermal-physics/th-kinetic-theory"
  "lesson-th3"      = "/c/thermal-physics/th-first-law"
  "lesson-th4"      = "/c/thermal-physics/th-second-law-entropy"
  "lesson-th5"      = "/c/thermal-physics/th-transport-real-gas"
  # --- W2: electromagnetism (6 lessons) ---
  "lesson-em1"      = "/c/electromagnetism/em-electrostatics"
  "lesson-em2"      = "/c/electromagnetism/em-potential-conductor"
  "lesson-em3"      = "/c/electromagnetism/em-magnetostatics"
  "lesson-em4"      = "/c/electromagnetism/em-induction"
  "lesson-em5"      = "/c/electromagnetism/em-magnetic-media"
  "lesson-em6"      = "/c/electromagnetism/em-maxwell-wave"
  # --- W2: optics (5 lessons) ---
  "lesson-opt1"     = "/c/optics/opt-geometric"
  "lesson-opt2"     = "/c/optics/opt-interference"
  "lesson-opt3"     = "/c/optics/opt-diffraction"
  "lesson-opt4"     = "/c/optics/opt-polarization"
  "lesson-opt5"     = "/c/optics/opt-resolution-dispersion"
  # --- W2: atomic physics (5 lessons) ---
  "lesson-atom1"    = "/c/atomic-physics/atom-blackbody-quantum"
  "lesson-atom2"    = "/c/atomic-physics/atom-photoelectric-photon"
  "lesson-atom3"    = "/c/atomic-physics/atom-bohr-hydrogen"
  "lesson-atom4"    = "/c/atomic-physics/atom-matter-waves"
  "lesson-atom5"    = "/c/atomic-physics/atom-multi-electron-nucleus"
  # --- W3: mathematical methods I (6 lessons) ---
  "w3course-mm1"   = "/c/math-methods-1"
  "lesson-w3-mm1a"         = "/c/math-methods-1/mm1-vector-calculus"
  "lesson-w3-mm1b"         = "/c/math-methods-1/mm1-complex-numbers"
  "lesson-w3-mm1c"         = "/c/math-methods-1/mm1-complex-integral"
  "lesson-w3-mm1d"         = "/c/math-methods-1/mm1-ode-first"
  "lesson-w3-mm1e"         = "/c/math-methods-1/mm1-ode-second"
  "lesson-w3-mm1f"         = "/c/math-methods-1/mm1-fourier-series"
  # --- W3: mathematical methods II (6 lessons) ---
  "w3course-mm2"   = "/c/math-methods-2"
  "lesson-w3-mm2a"         = "/c/math-methods-2/mm2-pde-classify"
  "lesson-w3-mm2b"         = "/c/math-methods-2/mm2-separation"
  "lesson-w3-mm2c"         = "/c/math-methods-2/mm2-heat-laplace"
  "lesson-w3-mm2d"         = "/c/math-methods-2/mm2-integral-transform"
  "lesson-w3-mm2e"         = "/c/math-methods-2/mm2-special-functions"
  "lesson-w3-mm2f"         = "/c/math-methods-2/mm2-green-function"
  # --- W3: theoretical mechanics (6 lessons) ---
  "w3course-tm"    = "/c/theoretical-mechanics"
  "lesson-w3-tma"          = "/c/theoretical-mechanics/tm-variational"
  "lesson-w3-tmb"          = "/c/theoretical-mechanics/tm-lagrange"
  "lesson-w3-tmc"          = "/c/theoretical-mechanics/tm-hamilton"
  "lesson-w3-tmd"          = "/c/theoretical-mechanics/tm-symmetry"
  "lesson-w3-tme"          = "/c/theoretical-mechanics/tm-rigid-body"
  "lesson-w3-tmf"          = "/c/theoretical-mechanics/tm-small-oscillation-chaos"
  # --- W3: statistical mechanics (6 lessons) ---
  "w3course-sm"    = "/c/statistical-mechanics"
  "lesson-w3-sma"          = "/c/statistical-mechanics/sm-thermo-laws"
  "lesson-w3-smb"          = "/c/statistical-mechanics/sm-thermo-potentials"
  "lesson-w3-smc"          = "/c/statistical-mechanics/sm-microcanonical"
  "lesson-w3-smd"          = "/c/statistical-mechanics/sm-canonical"
  "lesson-w3-sme"          = "/c/statistical-mechanics/sm-quantum-stats"
  "lesson-w3-smf"          = "/c/statistical-mechanics/sm-phase-transition"
  # --- W4: electrodynamics (6 lessons) ---
  "w4course-ed"            = "/c/electrodynamics"
  "lesson-w4-eda"          = "/c/electrodynamics/ed-maxwell-energy"
  "lesson-w4-edb"          = "/c/electrodynamics/ed-electrostatic-boundary"
  "lesson-w4-edc"          = "/c/electrodynamics/ed-magnetostatic-boundary"
  "lesson-w4-edd"          = "/c/electrodynamics/ed-wave-medium"
  "lesson-w4-ede"          = "/c/electrodynamics/ed-waveguide-radiation"
  "lesson-w4-edf"          = "/c/electrodynamics/ed-relativity"
  # --- W4: quantum mechanics I (6 lessons) ---
  "w4course-qm1"           = "/c/quantum-mechanics-1"
  "lesson-w4-qm1a"         = "/c/quantum-mechanics-1/qm1-wavefunction"
  "lesson-w4-qm1b"         = "/c/quantum-mechanics-1/qm1-well"
  "lesson-w4-qm1c"         = "/c/quantum-mechanics-1/qm1-tunneling"
  "lesson-w4-qm1d"         = "/c/quantum-mechanics-1/qm1-oscillator"
  "lesson-w4-qm1e"         = "/c/quantum-mechanics-1/qm1-angular-momentum"
  "lesson-w4-qm1f"         = "/c/quantum-mechanics-1/qm1-hydrogen"
  # --- W4: quantum mechanics II (6 lessons) ---
  "w4course-qm2"           = "/c/quantum-mechanics-2"
  "lesson-w4-qm2a"         = "/c/quantum-mechanics-2/qm2-perturbation"
  "lesson-w4-qm2b"         = "/c/quantum-mechanics-2/qm2-variational"
  "lesson-w4-qm2c"         = "/c/quantum-mechanics-2/qm2-scattering"
  "lesson-w4-qm2d"         = "/c/quantum-mechanics-2/qm2-identical-particles"
  "lesson-w4-qm2e"         = "/c/quantum-mechanics-2/qm2-entanglement"
  "lesson-w4-qm2f"         = "/c/quantum-mechanics-2/qm2-open-systems"
  # --- W5a: solid state physics (6 lessons) ---
  "w5course-ss"            = "/c/solid-state-physics"
  "lesson-w5-ssa"          = "/c/solid-state-physics/ss-crystal-structure"
  "lesson-w5-ssb"          = "/c/solid-state-physics/ss-reciprocal-diffraction"
  "lesson-w5-ssc"          = "/c/solid-state-physics/ss-lattice-vibration"
  "lesson-w5-ssd"          = "/c/solid-state-physics/ss-band-theory"
  "lesson-w5-sse"          = "/c/solid-state-physics/ss-semiconductor"
  "lesson-w5-ssf"          = "/c/solid-state-physics/ss-magnetism-superconductivity"
  # --- W5a: nuclear and particle physics (5 lessons) ---
  "w5course-npp"           = "/c/nuclear-particle"
  "lesson-w5-nppa"         = "/c/nuclear-particle/npp-nucleus-decay"
  "lesson-w5-nppb"         = "/c/nuclear-particle/npp-binding-reactions"
  "lesson-w5-nppc"         = "/c/nuclear-particle/npp-scattering-cross-section"
  "lesson-w5-nppd"         = "/c/nuclear-particle/npp-interactions-conservation"
  "lesson-w5-nppe"         = "/c/nuclear-particle/npp-standard-model"
  # --- W5a: astrophysics and cosmology (5 lessons) ---
  "w5course-astro"         = "/c/astrophysics-cosmology"
  "lesson-w5-astroa"       = "/c/astrophysics-cosmology/astro-stellar-structure"
  "lesson-w5-astrob"       = "/c/astrophysics-cosmology/astro-stellar-evolution"
  "lesson-w5-astroc"       = "/c/astrophysics-cosmology/astro-galaxies-dark-matter"
  "lesson-w5-astrod"       = "/c/astrophysics-cosmology/astro-expanding-universe"
  "lesson-w5-astroe"       = "/c/astrophysics-cosmology/astro-cmb-dark-energy"
  # --- W5a: quantum information (5 lessons) ---
  "w5course-qi"            = "/c/quantum-information"
  "lesson-w5-qia"          = "/c/quantum-information/qi-qubit-bloch"
  "lesson-w5-qib"          = "/c/quantum-information/qi-gates-circuits"
  "lesson-w5-qic"          = "/c/quantum-information/qi-entanglement-bell"
  "lesson-w5-qid"          = "/c/quantum-information/qi-decoherence-error"
  "lesson-w5-qie"          = "/c/quantum-information/qi-algorithms-frontier"
  # --- W5b: computational physics (6 lessons) ---
  "w5course-cp"            = "/c/computational-physics"
  "lesson-w5-cpa"          = "/c/computational-physics/cp-errors-ode"
  "lesson-w5-cpb"          = "/c/computational-physics/cp-integration-montecarlo"
  "lesson-w5-cpc"          = "/c/computational-physics/cp-fft-spectral"
  "lesson-w5-cpd"          = "/c/computational-physics/cp-montecarlo-simulation"
  "lesson-w5-cpe"          = "/c/computational-physics/cp-linear-algebra"
  "lesson-w5-cpf"          = "/c/computational-physics/cp-python-practice"
  # --- W5b: nonlinear dynamics and chaos (5 lessons) ---
  "w5course-nc"            = "/c/nonlinear-chaos"
  "lesson-w5-nca"          = "/c/nonlinear-chaos/nc-nonlinear-basics"
  "lesson-w5-ncb"          = "/c/nonlinear-chaos/nc-bifurcation"
  "lesson-w5-ncc"          = "/c/nonlinear-chaos/nc-lyapunov"
  "lesson-w5-ncd"          = "/c/nonlinear-chaos/nc-fractals"
  "lesson-w5-nce"          = "/c/nonlinear-chaos/nc-applications"
  # --- W5b: general relativity (5 lessons) ---
  "w5course-gr"            = "/c/general-relativity"
  "lesson-w5-gra"          = "/c/general-relativity/gr-special-relativity-review"
  "lesson-w5-grb"          = "/c/general-relativity/gr-equivalence-curvature"
  "lesson-w5-grc"          = "/c/general-relativity/gr-schwarzschild"
  "lesson-w5-grd"          = "/c/general-relativity/gr-black-holes"
  "lesson-w5-gre"          = "/c/general-relativity/gr-gravitational-waves-cosmology"
  # --- W5b: continuum and fluids (5 lessons) ---
  "w5course-cf"            = "/c/continuum-fluids"
  "lesson-w5-cfa"          = "/c/continuum-fluids/cf-fluid-statics"
  "lesson-w5-cfb"          = "/c/continuum-fluids/cf-continuity-bernoulli"
  "lesson-w5-cfc"          = "/c/continuum-fluids/cf-viscosity-poiseuille"
  "lesson-w5-cfd"          = "/c/continuum-fluids/cf-boundary-layer-turbulence"
  "lesson-w5-cfe"          = "/c/continuum-fluids/cf-waves-shock"
  # --- W6: general physics lab (6 lessons) ---
  "w6course-pl1"           = "/c/physics-lab-1"
  "lesson-w6-pl1a"         = "/c/physics-lab-1/pl1-measurement-uncertainty"
  "lesson-w6-pl1b"         = "/c/physics-lab-1/pl1-data-analysis"
  "lesson-w6-pl1c"         = "/c/physics-lab-1/pl1-mechanics-experiments"
  "lesson-w6-pl1d"         = "/c/physics-lab-1/pl1-thermal-electrical"
  "lesson-w6-pl1e"         = "/c/physics-lab-1/pl1-optics-experiments"
  "lesson-w6-pl1f"         = "/c/physics-lab-1/pl1-report-writing"
  # --- W6: modern physics lab (5 lessons) ---
  "w6course-pl2"           = "/c/physics-lab-2"
  "lesson-w6-pl2a"         = "/c/physics-lab-2/pl2-photoelectric-millikan"
  "lesson-w6-pl2b"         = "/c/physics-lab-2/pl2-franck-hertz-spectra"
  "lesson-w6-pl2c"         = "/c/physics-lab-2/pl2-zeeman-stern-gerlach"
  "lesson-w6-pl2d"         = "/c/physics-lab-2/pl2-nuclear-radiation"
  "lesson-w6-pl2e"         = "/c/physics-lab-2/pl2-modern-topics"
  # --- W6: history of physics (5 lessons) ---
  "w6course-ph"            = "/c/physics-history"
  "lesson-w6-pha"          = "/c/physics-history/ph-aristotle-to-galileo"
  "lesson-w6-phb"          = "/c/physics-history/ph-newtonian-synthesis"
  "lesson-w6-phc"          = "/c/physics-history/ph-thermo-electromagnetism"
  "lesson-w6-phd"          = "/c/physics-history/ph-relativity-quantum"
  "lesson-w6-phe"          = "/c/physics-history/ph-modern-frontiers"
  # --- W6: exam prep, general physics (5 lessons) ---
  "w6course-egp"           = "/c/exam-general-physics"
  "lesson-w6-egpa"         = "/c/exam-general-physics/egp-mechanics"
  "lesson-w6-egpb"         = "/c/exam-general-physics/egp-thermal"
  "lesson-w6-egpc"         = "/c/exam-general-physics/egp-electromagnetism"
  "lesson-w6-egpd"         = "/c/exam-general-physics/egp-optics-waves"
  "lesson-w6-egpe"         = "/c/exam-general-physics/egp-mock-exam"
  # --- W6: exam prep, quantum mechanics (5 lessons) ---
  "w6course-eqm"           = "/c/exam-quantum"
  "lesson-w6-eqma"         = "/c/exam-quantum/eqm-wavefunction-well"
  "lesson-w6-eqmb"         = "/c/exam-quantum/eqm-barrier-oscillator"
  "lesson-w6-eqmc"         = "/c/exam-quantum/eqm-operator-formalism"
  "lesson-w6-eqmd"         = "/c/exam-quantum/eqm-angular-hydrogen"
  "lesson-w6-eqme"         = "/c/exam-quantum/eqm-approximation-mock"
}

foreach ($name in $routes.Keys) {
  if ($Only -ne "" -and $name -notlike "*$Only*") { continue }
  $out = Join-Path $domDir "$name.html"
  $args = @(
    '--headless=new', '--disable-gpu', '--no-sandbox', '--disable-crash-reporter', '--no-first-run',
    "--user-data-dir=$profileDir", '--virtual-time-budget=10000', '--dump-dom', ($urlBase + $routes[$name])
  )
  Write-Output ("  rendering " + $name + " ...")
  if (Test-Path $out) { Remove-Item $out -Force }
  cmd.exe /c ('"' + $browser + '" ' + (($args | ForEach-Object { '"' + $_ + '"' }) -join ' ') + ' > "' + $out + '" 2>nul')
}

# Formula rendering self-check page (standalone file, not a route)
$demoOut = Join-Path $domDir "formula-demo.html"
$demoUrl = "file:///" + ($base -replace '\\', '/') + "/tools/formula-demo.html"
$demoArgs = @(
  '--headless=new', '--disable-gpu', '--no-sandbox', '--disable-crash-reporter', '--no-first-run',
  "--user-data-dir=$profileDir", '--virtual-time-budget=10000', '--dump-dom', $demoUrl
)
Write-Output "  rendering formula-demo ..."
if (Test-Path $demoOut) { Remove-Item $demoOut -Force }
cmd.exe /c ('"' + $browser + '" ' + (($demoArgs | ForEach-Object { '"' + $_ + '"' }) -join ' ') + ' > "' + $demoOut + '" 2>nul')

$domArgs = @()
if ($Only -ne "") { $domArgs += "--partial" }
node (Join-Path $base "tools\verify-dom.mjs") @domArgs
exit $LASTEXITCODE
