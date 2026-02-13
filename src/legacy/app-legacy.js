/**
 * WBS Terminal v2.0 - Legacy Application Code
 * This file contains the original application logic.
 * Functions are exported to window for HTML onclick handlers.
 */

console.log('🚀 Legacy app-legacy.js module loading...');

// Immediately expose placeholder functions to window
// These will be reassigned to the actual functions as they're defined
window.discardRecovery = function() { console.warn('discardRecovery not yet loaded'); };
window.restoreRecovery = function() { console.warn('restoreRecovery not yet loaded'); };
window.dismissRecovery = function() { console.warn('dismissRecovery not yet loaded'); };
window.nextStep = function() { console.warn('nextStep not yet loaded'); };
window.prevStep = function() { console.warn('prevStep not yet loaded'); };
window.toggleDisc = function() { console.warn('toggleDisc not yet loaded'); };

// Data
let projectData = {
            phases: [],
            disciplines: [],
            packages: [],
            budgets: {},
            claiming: {},
            dates: {},
            // Unique identifiers for disciplines and packages
            disciplineIds: {},     // { "Roadway": "DISC-001", ... }
            packageIds: {},        // { "Preliminary": "PKG-001", ... }
            // Activities generated from discipline + package combinations
            activities: {},        // { "Roadway-Preliminary": { id: "DISC-001-PKG-001", description: "Roadway - Preliminary" }, ... }
            // Design review steps for schedule
            reviewSteps: {},       // { "Roadway-Preliminary": [{ step: "Design Development", start: "", end: "" }, ...] }
            calculator: {
                totalConstructionCost: 0,
                designFeePercent: 15,
                projectType: 'Highway/Roadway',
                totalDesignFee: 0,
                complexityOverrides: {},
                isCalculated: false,
                manualEdits: {}
            },
            // RFP-extracted data for export
            projectScope: '',
            scheduleNotes: '',
            disciplineScopes: {},
            rfpReviewSteps: [],  // Review steps extracted from RFP
            
            // Chapter 1 - Project Information
            projectInfo: {
                projectName: '',
                projectLocation: '',
                leadDistrict: '',
                partneringDistricts: '',
                kieNonSpPercentage: '',
                technicalProposalDue: '',
                priceProposalDue: '',
                interviewDate: '',
                contractAward: '',
                noticeToProceed: '',
                stipendAmount: '',
                ownerContractType: '',
                kegEntity: '',
                evaluationCriteria: '',
                dbeGoals: ''
            },
            
            // Chapter 2 - Commercial Status
            commercialTerms: {
                client: '',
                projectValue: '',
                projectStatus: '',
                waiverConsequentialDamages: '',
                limitationOfLiability: '',
                professionalLiability: '',
                insuranceRequirements: '',
                standardOfCare: '',
                reliedUponInformation: '',
                thirdPartyDelays: '',
                thirdPartyContractorImpacts: '',
                indemnification: ''
            },
            
            // Chapter 3 - Project Organization
            projectOrganization: ''
        };

        let currentStep = 4; // Start at Benchmarking (formerly Budget)
        let chart = null;

        // ============================================
        // PERSISTENCE SYSTEM
        // ============================================
        
        const STORAGE_KEY = 'wbs_project_autosave';
        const STORAGE_VERSION = 1;
        let autosaveTimeout = null;
        let lastSaveTime = null;

        // ============================================
        // DESIGN REVIEW STEPS CONFIGURATION
        // ============================================
        
        /**
         * Industry-standard review step durations by project type
         * Durations are in calendar days for a typical package
         * Based on DOT and infrastructure industry standards
         */
        const INDUSTRY_REVIEW_DURATIONS = {
            // Highway/Roadway projects - moderate review cycles
            'Highway/Roadway': {
                default: {
                    'Design Development': 21,
                    'IDR/CR (Internal Design Review)': 5,
                    "Owner's Review": 14,
                    'Address Comments': 10,
                    'Final Approval': 5
                },
                // Discipline-specific adjustments (multiplier)
                disciplines: {
                    'Roadway': 1.0,
                    'Drainage': 0.9,
                    'Traffic': 0.8,
                    'Signing': 0.6,
                    'Pavement Marking': 0.5,
                    'Utilities': 0.9,
                    'Survey': 0.7,
                    'Environmental': 1.1,
                    'Geotechnical': 0.8
                }
            },
            // Bridge projects - longer structural reviews
            'Bridge': {
                default: {
                    'Design Development': 28,
                    'IDR/CR (Internal Design Review)': 7,
                    "Owner's Review": 21,
                    'Address Comments': 14,
                    'Final Approval': 7
                },
                disciplines: {
                    'Structures': 1.2,
                    'Roadway': 0.8,
                    'Drainage': 0.7,
                    'Geotechnical': 1.1,
                    'Traffic': 0.6,
                    'Utilities': 0.7
                }
            },
            // Transit/Rail - complex multi-discipline coordination
            'Transit': {
                default: {
                    'Design Development': 35,
                    'IDR/CR (Internal Design Review)': 10,
                    "Owner's Review": 28,
                    'Address Comments': 21,
                    'Final Approval': 10
                },
                disciplines: {
                    'Structures': 1.1,
                    'Track': 1.2,
                    'Systems': 1.3,
                    'Traffic': 0.8,
                    'Drainage': 0.7,
                    'Utilities': 0.9,
                    'Landscaping': 0.6
                }
            },
            // Drainage/Utilities - shorter cycles
            'Drainage/Utilities': {
                default: {
                    'Design Development': 18,
                    'IDR/CR (Internal Design Review)': 4,
                    "Owner's Review": 10,
                    'Address Comments': 7,
                    'Final Approval': 4
                },
                disciplines: {
                    'Drainage': 1.0,
                    'Utilities': 1.0,
                    'Roadway': 0.8,
                    'Environmental': 1.1,
                    'Survey': 0.7
                }
            },
            // Intersection - moderate cycles
            'Intersection': {
                default: {
                    'Design Development': 18,
                    'IDR/CR (Internal Design Review)': 5,
                    "Owner's Review": 12,
                    'Address Comments': 8,
                    'Final Approval': 5
                },
                disciplines: {
                    'Roadway': 1.0,
                    'Traffic': 1.1,
                    'Signals': 1.2,
                    'Signing': 0.7,
                    'Pavement Marking': 0.5,
                    'Drainage': 0.8
                }
            }
        };

        /**
         * Package/deliverable multipliers - some packages need longer reviews
         */
        const PACKAGE_DURATION_MULTIPLIERS = {
            'Preliminary': 0.7,      // Shorter reviews for early concepts
            'Interim': 0.9,          // Moderate reviews
            'Final': 1.2,            // Thorough final reviews
            'RFC': 1.0,              // Ready for construction - standard
            'As-Built': 0.5,         // Quick verification only
            '30%': 0.6,
            '60%': 0.85,
            '90%': 1.1,
            '100%': 1.0,
            'Basis of Design': 0.8,  // BOD is typically shorter overall
            'BOD': 0.8
        };

        /**
         * Special review steps for specific package types
         * These override the default industry steps when the package matches
         */
        const PACKAGE_SPECIFIC_REVIEW_STEPS = {
            'Basis of Design': [
                { name: 'BOD Development', durationPercent: 38 },
                { name: 'Internal Technical Review', durationPercent: 12 },
                { name: 'Owner Workshop/Review', durationPercent: 22 },
                { name: 'Incorporate Feedback', durationPercent: 18 },
                { name: 'BOD Approval/Sign-off', durationPercent: 10 }
            ],
            'BOD': [
                { name: 'BOD Development', durationPercent: 38 },
                { name: 'Internal Technical Review', durationPercent: 12 },
                { name: 'Owner Workshop/Review', durationPercent: 22 },
                { name: 'Incorporate Feedback', durationPercent: 18 },
                { name: 'BOD Approval/Sign-off', durationPercent: 10 }
            ],
            'Concept': [
                { name: 'Concept Development', durationPercent: 40 },
                { name: 'Internal Review', durationPercent: 15 },
                { name: 'Client Presentation', durationPercent: 20 },
                { name: 'Refine Concept', durationPercent: 15 },
                { name: 'Concept Approval', durationPercent: 10 }
            ],
            'Schematic': [
                { name: 'Schematic Development', durationPercent: 40 },
                { name: 'Internal Review', durationPercent: 12 },
                { name: 'Owner Review', durationPercent: 20 },
                { name: 'Address Comments', durationPercent: 18 },
                { name: 'Schematic Approval', durationPercent: 10 }
            ]
        };

        /**
         * Returns null to always use industry-standard generic steps
         * RFP-based steps are disabled - using generic steps only
         * @returns {null} Always returns null to use default industry steps
         */
        function parseRfpScheduleSteps() {
            // Always use generic industry-standard steps
            return null;
        }
        
        /**
         * Gets review step durations - checks for package-specific steps first, then uses industry standards
         * @param {string} discipline - The discipline name
         * @param {string} packageName - The package/deliverable name
         * @returns {Array} Array of review steps with calculated durations
         */
        function getIndustryReviewSteps(discipline, packageName) {
            // Determine project type from calculator settings or default
            const projectType = projectData.calculator?.projectType || 'Highway/Roadway';
            
            // Get base durations for project type (fallback to Highway/Roadway)
            const typeConfig = INDUSTRY_REVIEW_DURATIONS[projectType] || 
                              INDUSTRY_REVIEW_DURATIONS['Highway/Roadway'];
            
            // Get discipline multiplier
            const discMultiplier = typeConfig.disciplines?.[discipline] || 1.0;
            
            // Get package multiplier
            const pkgMultiplier = PACKAGE_DURATION_MULTIPLIERS[packageName] || 1.0;
            
            // Check for package-specific review steps (e.g., Basis of Design, Concept, Schematic)
            const packageSpecificSteps = PACKAGE_SPECIFIC_REVIEW_STEPS[packageName];
            
            if (packageSpecificSteps) {
                // Use package-specific steps with adjusted durations
                const baseTotalDays = 55; // Base total days for calculation
                return packageSpecificSteps.map(step => {
                    const adjustedDays = Math.max(1, Math.round(baseTotalDays * (step.durationPercent / 100) * discMultiplier * pkgMultiplier));
                    return {
                        name: step.name,
                        durationPercent: step.durationPercent,
                        industryDays: adjustedDays
                    };
                });
            }
            
            // Use default industry standard steps
            const steps = Object.entries(typeConfig.default).map(([stepName, baseDays]) => {
                const adjustedDays = Math.max(1, Math.round(baseDays * discMultiplier * pkgMultiplier));
                return {
                    name: stepName,
                    baseDays: adjustedDays
                };
            });
            
            // Calculate total and percentages
            const totalDays = steps.reduce((sum, s) => sum + s.baseDays, 0);
            
            return steps.map(step => ({
                name: step.name,
                durationPercent: Math.round((step.baseDays / totalDays) * 100),
                industryDays: step.baseDays
            }));
        }
        
        /**
         * Default review steps (fallback when no project type is set)
         */
        const DEFAULT_REVIEW_STEPS = [
            { name: 'Design Development', durationPercent: 40 },
            { name: 'IDR/CR (Internal Design Review)', durationPercent: 10 },
            { name: "Owner's Review", durationPercent: 20 },
            { name: 'Address Comments', durationPercent: 20 },
            { name: 'Final Approval', durationPercent: 10 }
        ];

        /**
         * Generates a unique discipline ID
         * @param {string} disciplineName - The discipline name
         * @param {number} index - Index for generating sequential ID
         * @returns {string} Unique discipline ID like "DISC-001"
         */
        function generateDisciplineId(disciplineName, index) {
            const paddedIndex = String(index + 1).padStart(3, '0');
            return `DISC-${paddedIndex}`;
        }

        /**
         * Generates a unique package/scope item ID
         * @param {string} packageName - The package name
         * @param {number} index - Index for generating sequential ID
         * @returns {string} Unique package ID like "PKG-001"
         */
        function generatePackageId(packageName, index) {
            const paddedIndex = String(index + 1).padStart(3, '0');
            return `PKG-${paddedIndex}`;
        }

        /**
         * Generates activity ID and description for a discipline-package combination
         * Activity ID format: PackageClaiming (e.g., "Preliminary20" for 20% claiming)
         * @param {string} discipline - Discipline name
         * @param {string} packageName - Package/scope item name
         * @returns {object} { id: "Preliminary20", description: "Preliminary - Roadway (20%)" }
         */
        function generateActivityInfo(discipline, packageName) {
            // Remove spaces and special characters for clean ID
            const cleanPkg = packageName.replace(/[^a-zA-Z0-9]/g, '');
            
            // Get claiming percentage for this discipline-package combination
            const key = `${discipline}-${packageName}`;
            const claimingPct = projectData.claiming[key] || 0;
            
            return {
                id: `${cleanPkg}${claimingPct}`,
                description: `${packageName} - ${discipline} (${claimingPct}%)`
            };
        }

        /**
         * Initializes unique IDs for all disciplines and packages
         * Called when disciplines or packages are added/modified
         */
        function initializeUniqueIds() {
            // Generate discipline IDs
            projectData.disciplines.forEach((disc, index) => {
                if (!projectData.disciplineIds[disc]) {
                    projectData.disciplineIds[disc] = generateDisciplineId(disc, index);
                }
            });
            
            // Generate package IDs
            projectData.packages.forEach((pkg, index) => {
                if (!projectData.packageIds[pkg]) {
                    projectData.packageIds[pkg] = generatePackageId(pkg, index);
                }
            });
            
            // Generate activity info for all combinations (always regenerate to ensure correct format)
            projectData.disciplines.forEach(disc => {
                projectData.packages.forEach(pkg => {
                    const key = `${disc}-${pkg}`;
                    projectData.activities[key] = generateActivityInfo(disc, pkg);
                });
            });
        }

        /**
         * Initializes design review steps for an activity using industry-standard durations
         * Generic steps: Design Development, IDR/CR, Owner's Review, Address Comments, Final Approval
         * @param {string} discipline - Discipline name
         * @param {string} packageName - Package name
         */
        function initializeReviewSteps(discipline, packageName) {
            const key = `${discipline}-${packageName}`;
            const dates = projectData.dates[key] || {};
            
            if (!projectData.reviewSteps[key] && dates.start && dates.end) {
                const startDate = new Date(dates.start);
                const endDate = new Date(dates.end);
                const totalDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
                
                // Get industry-standard review steps
                const reviewSteps = getIndustryReviewSteps(discipline, packageName);
                
                let currentStart = new Date(startDate);
                projectData.reviewSteps[key] = reviewSteps.map(step => {
                    // Calculate actual days based on percentages scaled to activity duration
                    const stepDays = Math.max(1, Math.ceil(totalDays * (step.durationPercent / 100)));
                    const stepEnd = new Date(currentStart);
                    stepEnd.setDate(stepEnd.getDate() + stepDays);
                    
                    const result = {
                        step: step.name,
                        start: currentStart.toISOString().split('T')[0],
                        end: stepEnd.toISOString().split('T')[0],
                        days: stepDays,
                        industryDays: step.industryDays // Store industry baseline for reference
                    };
                    
                    currentStart = new Date(stepEnd);
                    return result;
                });
            }
        }

        /**
         * Debounce utility for autosave
         */
        function debounce(func, wait) {
            return function executedFunction(...args) {
                clearTimeout(autosaveTimeout);
                autosaveTimeout = setTimeout(() => func.apply(this, args), wait);
            };
        }

        /**
         * Shows the autosave indicator
         */
        function showAutosaveIndicator(status) {
            const indicator = document.getElementById('autosave-indicator');
            const icon = document.getElementById('autosave-icon');
            const text = document.getElementById('autosave-text');
            
            if (!indicator) return;
            
            indicator.classList.remove('saving', 'saved');
            
            if (status === 'saving') {
                indicator.classList.add('visible', 'saving');
                icon.textContent = '◐';
                text.textContent = 'Saving...';
            } else if (status === 'saved') {
                indicator.classList.add('visible', 'saved');
                icon.textContent = '✓';
                text.textContent = 'Saved';
                setTimeout(() => {
                    indicator.classList.remove('visible');
                }, 2000);
            }
        }

        /**
         * Saves project data to localStorage
         */
        function saveToLocalStorage() {
            try {
                showAutosaveIndicator('saving');
                
                const saveData = {
                    version: STORAGE_VERSION,
                    timestamp: Date.now(),
                    currentStep: currentStep,
                    projectData: projectData,
                    // Also save form values that might not be in projectData yet
                    formState: {
                        phases: document.getElementById('phases-input')?.value || '',
                        packages: document.getElementById('packages-input')?.value || ''
                    }
                };
                
                localStorage.setItem(STORAGE_KEY, JSON.stringify(saveData));
                lastSaveTime = Date.now();
                
                setTimeout(() => showAutosaveIndicator('saved'), 300);
                console.log('Project autosaved:', new Date().toLocaleTimeString());
            } catch (error) {
                console.error('Autosave failed:', error);
            }
        }

        /**
         * Debounced autosave function - saves 1 second after last change
         */
        const autosave = debounce(saveToLocalStorage, 1000);

        /**
         * Triggers autosave on any data change
         */
        function triggerAutosave() {
            autosave();
        }

        /**
         * Loads saved data from localStorage
         * @returns {object|null} The saved data or null if none exists
         */
        function loadFromLocalStorage() {
            try {
                const saved = localStorage.getItem(STORAGE_KEY);
                if (!saved) return null;
                
                const data = JSON.parse(saved);
                
                // Check version compatibility
                if (data.version !== STORAGE_VERSION) {
                    console.warn('Saved data version mismatch, discarding');
                    return null;
                }
                
                return data;
            } catch (error) {
                console.error('Failed to load saved data:', error);
                return null;
            }
        }

        /**
         * Checks if saved data has meaningful content worth recovering
         */
        function hasMeaningfulData(data) {
            if (!data || !data.projectData) return false;
            
            const pd = data.projectData;
            return (
                pd.phases.length > 0 ||
                pd.disciplines.length > 0 ||
                pd.packages.length > 0 ||
                Object.keys(pd.budgets).length > 0 ||
                pd.projectScope
            );
        }

        /**
         * Formats a timestamp for display
         */
        function formatTimestamp(ts) {
            const date = new Date(ts);
            const now = new Date();
            const diffMs = now - date;
            const diffMins = Math.floor(diffMs / 60000);
            const diffHours = Math.floor(diffMs / 3600000);
            const diffDays = Math.floor(diffMs / 86400000);
            
            if (diffMins < 1) return 'Just now';
            if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
            if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
            if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
            return date.toLocaleDateString();
        }

        /**
         * Formats currency amount as a US dollar string
         */
        function formatCurrency(amount) {
            return '$' + Math.round(amount || 0).toLocaleString('en-US');
        }

        /**
         * Toggles a field between disabled (greyed out) and enabled (editable)
         * @param {string} fieldId - The ID of the field to toggle
         * @param {boolean} enabled - Whether to enable or disable the field
         */
        function toggleFieldEdit(fieldId, enabled) {
            const field = document.getElementById(fieldId);
            if (!field) return;
            
            if (enabled) {
                field.disabled = false;
                field.style.backgroundColor = '#ffffff';
                field.style.color = '#333';
                field.style.cursor = 'text';
            } else {
                field.disabled = true;
                field.style.backgroundColor = '#e0e0e0';
                field.style.color = '#666';
                field.style.cursor = 'not-allowed';
            }
        }

        /**
         * Formats an input field value as accounting format (e.g., $1,234,567.00)
         * @param {HTMLInputElement} input - The input element to format
         */
        function formatAccountingInput(input) {
            // Remove any non-numeric characters except decimal point
            let value = input.value.replace(/[^0-9.]/g, '');
            
            // Parse as number
            let numValue = parseFloat(value) || 0;
            
            // Format as accounting (US currency with 2 decimal places)
            input.value = numValue.toLocaleString('en-US', {
                style: 'currency',
                currency: 'USD',
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            });
            
            // Trigger the assumed construction cost calculation
            calculateAssumedConstructionCost();
        }

        /**
         * Calculates Assumed Construction Cost = Initial Project Value / (1 + Margin%)
         */
        function calculateAssumedConstructionCost() {
            const initialValueInput = document.getElementById('calc-est-construction-cost');
            const marginInput = document.getElementById('calc-construction-margin');
            const assumedCostOutput = document.getElementById('calc-assumed-construction-cost');
            
            if (!initialValueInput || !marginInput || !assumedCostOutput) return;
            
            // Parse the initial value (remove currency formatting)
            let initialValue = parseFloat(initialValueInput.value.replace(/[^0-9.]/g, '')) || 0;
            let marginPercent = parseFloat(marginInput.value) || 15;
            
            // Calculate assumed construction cost: Initial Value / (1 + margin%)
            let divisor = 1 + (marginPercent / 100);
            let assumedCost = initialValue / divisor;
            
            // Format and display
            assumedCostOutput.value = assumedCost.toLocaleString('en-US', {
                style: 'currency',
                currency: 'USD',
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            });
        }

        /**
         * Toggles the visibility of revenue detail columns (Raw Labor, Burden, G&A, Margin)
         */
        function toggleRevenueDetails() {
            const table = document.getElementById('unified-estimate-table');
            if (table) {
                table.classList.toggle('revenue-details-visible');
            }
        }

        /**
         * Calculates and displays the Margin % based on KIE Multiplier, Burden Rate, and G&A Rate
         * Margin % = KIE Multiplier - 1 (raw labor) - Burden Rate - G&A Rate
         */
        function calculateMarginPercent() {
            const kieMultiplierInput = document.getElementById('calc-kie-multiplier');
            const burdenRateInput = document.getElementById('unified-burden');
            const gnaRateInput = document.getElementById('unified-gna');
            const marginPercentOutput = document.getElementById('calc-margin-percent');
            
            if (!kieMultiplierInput || !marginPercentOutput) return;
            
            const kieMultiplier = parseFloat(kieMultiplierInput.value) || 2.85;
            const burdenRate = (parseFloat(burdenRateInput?.value) || 66) / 100; // Convert 66 to 0.66
            const gnaRate = (parseFloat(gnaRateInput?.value) || 104) / 100; // Convert 104 to 1.04
            
            // Margin % = KIE Multiplier - Raw Labor (1) - Burden Rate - G&A Rate
            const marginPercent = kieMultiplier - 1 - burdenRate - gnaRate;
            
            // Display as percentage
            marginPercentOutput.value = (marginPercent * 100).toFixed(2) + '%';
            
            // Store margin percent for use in calculations
            window.calculatedMarginPercent = marginPercent;
        }

        // ============================================
        // ESCALATION MODAL FUNCTIONS
        // ============================================
        
        // Store escalation data for the modal
        let escalationData = {
            baseRate: 5,
            years: 3,
            totalHours: 0,
            totalCost: 0,
            yearlyBreakdown: [],
            manualOverrides: {},
            hourDistributionOverrides: {}
        };
        
        let escalationChart = null;

        /**
         * Opens the escalation breakdown modal
         */
        function openEscalationModal() {
            const modal = document.getElementById('escalation-modal');
            if (!modal) return;

            const noDurationMsg = document.getElementById('escalation-no-duration-msg');
            const modalContent = document.getElementById('escalation-modal-content');

            // Get duration from Cost Calculation Parameters (Budget step)
            const durationInput = document.getElementById('calc-design-duration');
            const durationVal = durationInput ? durationInput.value : '';
            const durationMonths = parseFloat(durationVal);

            const hasDuration = durationVal !== '' && !isNaN(durationMonths) && durationMonths > 0;

            if (!hasDuration) {
                if (noDurationMsg) noDurationMsg.style.display = '';
                if (modalContent) modalContent.style.display = 'none';
                modal.classList.add('open');
                return;
            }

            if (noDurationMsg) noDurationMsg.style.display = 'none';
            if (modalContent) modalContent.style.display = '';

            // Get current values from the main form
            const escalationRateInput = document.getElementById('unified-escalation');
            escalationData.baseRate = parseFloat(escalationRateInput?.value) || 5;
            escalationData.durationMonths = durationMonths;
            escalationData.years = Math.ceil(durationMonths / 12);
            if (escalationData.years < 1) escalationData.years = 1;
            if (escalationData.years > 10) escalationData.years = 10;

            // Get total hours from the table
            const totalMHElement = document.getElementById('kie-labor-total-mh');
            escalationData.totalHours = parseFloat(totalMHElement?.textContent?.replace(/,/g, '')) || 0;

            // Update modal inputs
            document.getElementById('escalation-base-rate').value = escalationData.baseRate;
            document.getElementById('escalation-duration-months').value = durationMonths;

            // Set NTP date to today if not already set
            const ntpDateInput = document.getElementById('escalation-ntp-date');
            if (ntpDateInput && !ntpDateInput.value) {
                const today = new Date();
                const todayStr = today.toISOString().split('T')[0];
                ntpDateInput.value = todayStr;
            }

            recalculateEscalation();
            modal.classList.add('open');
        }

        /**
         * Closes the escalation modal
         */
        function closeEscalationModal() {
            const modal = document.getElementById('escalation-modal');
            if (modal) modal.classList.remove('open');
        }

        /**
         * Recalculates escalation based on current inputs
         * Uses monthly bell curve distribution with fiscal year logic (March to March)
         * Base: Total Raw Labor for Directs + Indirects (Cost-based, not hours)
         */
        function recalculateEscalation() {
            const noDurationMsg = document.getElementById('escalation-no-duration-msg');
            const modalContent = document.getElementById('escalation-modal-content');
            const durationInput = document.getElementById('escalation-duration-months');
            const durationVal = durationInput ? durationInput.value : '';
            const durationMonths = parseInt(durationVal, 10);
            const hasDuration = durationVal !== '' && !isNaN(durationMonths) && durationMonths > 0;

            if (!hasDuration) {
                if (noDurationMsg) noDurationMsg.style.display = '';
                if (modalContent) modalContent.style.display = 'none';
                return;
            }

            if (noDurationMsg) noDurationMsg.style.display = 'none';
            if (modalContent) modalContent.style.display = '';

            const baseRate = parseFloat(document.getElementById('escalation-base-rate')?.value) || 5;
            const years = Math.ceil(durationMonths / 12);

            escalationData.baseRate = baseRate;
            escalationData.years = years;
            escalationData.durationMonths = durationMonths;
            
            // Get total RAW LABOR for Directs and Indirects (Cost-based escalation)
            const directsRawLabor = parseFloat(document.getElementById('unified-direct-total-raw-labor')?.textContent?.replace(/[$,]/g, '')) || 0;
            const indirectsRawLabor = parseFloat(document.getElementById('unified-indirect-total-raw-labor')?.textContent?.replace(/[$,]/g, '')) || 0;
            const totalRawLaborCost = directsRawLabor + indirectsRawLabor;
            escalationData.totalRawLaborCost = totalRawLaborCost;
            
            // Keep totalHours for reference (but not used for escalation calculation)
            const kieLaborMH = parseFloat(document.getElementById('kie-labor-total-mh')?.textContent?.replace(/,/g, '')) || 0;
            const esdcMH = parseFloat(document.getElementById('esdc-total-mh')?.textContent?.replace(/,/g, '')) || 0;
            const tscdMH = parseFloat(document.getElementById('tscd-total-mh')?.textContent?.replace(/,/g, '')) || 0;
            const totalHours = Math.max(0, kieLaborMH - esdcMH - tscdMH);
            escalationData.totalHours = totalHours;
            
            // Base cost for escalation = Total Raw Labor for Directs + Indirects
            const baseCost = totalRawLaborCost;
            
            // Get NTP date
            const ntpDateInput = document.getElementById('escalation-ntp-date');
            const ntpDate = ntpDateInput?.value ? new Date(ntpDateInput.value) : new Date();
            
            // ============================================
            // FISCAL YEAR LOGIC (March to March)
            // ============================================
            // Fiscal year runs March 1 to Feb 28/29
            // If NTP is before March of a year, escalation starts after March 1 of that year
            // If NTP is on or after March, no escalation until March 1 of the FOLLOWING year
            
            // Calculate the first March 1 AFTER which escalation applies
            const ntpMonth = ntpDate.getMonth(); // 0-11
            const ntpYear = ntpDate.getFullYear();
            
            let firstEscalationDate;
            if (ntpMonth < 2) {
                // NTP is Jan or Feb (before March) -> escalation starts after March 1 of same year
                firstEscalationDate = new Date(ntpYear, 2, 1); // March 1 of same year
            } else {
                // NTP is March or later -> no escalation until March 1 of NEXT year
                firstEscalationDate = new Date(ntpYear + 1, 2, 1); // March 1 of next year
            }
            
            // ============================================
            // CALCULATE MONTHLY BELL CURVE DISTRIBUTION
            // ============================================
            const monthlyDistribution = calculateMonthlyBellCurve(durationMonths);
            
            // Calculate monthly breakdown with escalation
            escalationData.monthlyBreakdown = [];
            escalationData.yearlyBreakdown = [];
            let totalEscalation = 0;
            let currentDate = new Date(ntpDate);
            
            // Track fiscal year totals
            const fiscalYearData = {};
            
            for (let m = 0; m < durationMonths; m++) {
                const monthDate = new Date(ntpDate);
                monthDate.setMonth(monthDate.getMonth() + m);
                
                // Distribute raw labor cost using bell curve (Cost-based escalation)
                const monthRawLaborCost = baseCost * monthlyDistribution[m];
                const monthHours = totalHours * monthlyDistribution[m]; // Keep for reference
                const monthBaseCost = monthRawLaborCost; // Base cost = raw labor cost for escalation
                
                // Determine fiscal year for this month
                // Fiscal year = the year of the March that ENDS this fiscal year
                // e.g., March 2026 - Feb 2027 is FY 2027
                const monthIdx = monthDate.getMonth();
                const year = monthDate.getFullYear();
                const fiscalYear = monthIdx >= 2 ? year + 1 : year; // March+ = next FY, Jan-Feb = current FY
                
                // Calculate escalation: only if month is AFTER the first escalation date
                let escalationYears = 0;
                let escalationFactor = 0;
                let escalationAmount = 0;
                
                if (monthDate >= firstEscalationDate) {
                    // Count how many March 1 dates have passed since firstEscalationDate
                    let marchCount = 0;
                    let checkDate = new Date(firstEscalationDate);
                    while (checkDate <= monthDate) {
                        if (checkDate.getMonth() === 2 && checkDate.getDate() === 1) {
                            marchCount++;
                        }
                        checkDate.setMonth(checkDate.getMonth() + 1);
                    }
                    escalationYears = marchCount;
                    escalationFactor = Math.pow(1 + (baseRate / 100), escalationYears) - 1;
                    escalationAmount = monthBaseCost * escalationFactor;
                }
                
                totalEscalation += escalationAmount;
                
                // Format month label - short format like "F26" for Feb 2026
                const monthLetters = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
                const yearShort = String(monthDate.getFullYear()).slice(-2); // Last 2 digits
                const monthLabel = `${monthLetters[monthDate.getMonth()]}${yearShort}`;
                // Full label for tooltip
                const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                const monthLabelFull = `${monthNames[monthDate.getMonth()]} ${monthDate.getFullYear()}`;
                
                escalationData.monthlyBreakdown.push({
                    month: m + 1,
                    label: monthLabel,
                    labelFull: monthLabelFull,
                    date: new Date(monthDate),
                    hours: monthHours,
                    hourPercent: monthlyDistribution[m] * 100,
                    rawLaborCost: monthRawLaborCost,
                    costPercent: monthlyDistribution[m] * 100,
                    baseCost: monthBaseCost,
                    escalationYears: escalationYears,
                    escalationFactor: escalationFactor,
                    escalationAmount: escalationAmount,
                    fiscalYear: fiscalYear
                });
                
                // Aggregate by fiscal year
                if (!fiscalYearData[fiscalYear]) {
                    fiscalYearData[fiscalYear] = { hours: 0, rawLaborCost: 0, baseCost: 0, escalationAmount: 0 };
                }
                fiscalYearData[fiscalYear].hours += monthHours;
                fiscalYearData[fiscalYear].rawLaborCost += monthRawLaborCost;
                fiscalYearData[fiscalYear].baseCost += monthBaseCost;
                fiscalYearData[fiscalYear].escalationAmount += escalationAmount;
            }
            
            // Convert fiscal year data to yearly breakdown for table
            let yearNum = 1;
            for (const [fy, data] of Object.entries(fiscalYearData).sort((a, b) => parseInt(a[0]) - parseInt(b[0]))) {
                const costPercent = (data.rawLaborCost / baseCost) * 100 || 0;
                const hourPercent = (data.hours / totalHours) * 100 || 0;
                const effectiveYears = yearNum === 1 ? 0 : yearNum - 1;
                
                escalationData.yearlyBreakdown.push({
                    year: yearNum,
                    fiscalYear: parseInt(fy),
                    hours: data.hours,
                    hourPercent: hourPercent,
                    rawLaborCost: data.rawLaborCost,
                    costPercent: costPercent,
                    rate: baseRate,
                    effectiveYears: effectiveYears,
                    compoundedFactor: data.baseCost > 0 ? data.escalationAmount / data.baseCost : 0,
                    escalationAmount: data.escalationAmount,
                    manualOverride: escalationData.manualOverrides?.[yearNum]
                });
                yearNum++;
            }
            
            escalationData.totalCost = totalEscalation;
            escalationData.firstEscalationDate = firstEscalationDate;
            
            // Render the table
            renderEscalationTable();
            
            // Render the bell curve chart (monthly view)
            renderEscalationChart();
        }
        
        /**
         * Calculate monthly bell curve distribution
         */
        function calculateMonthlyBellCurve(numMonths) {
            if (numMonths <= 1) return [1];
            
            const distribution = [];
            const midpoint = (numMonths - 1) / 2;
            const stdDev = numMonths / 4;
            
            let total = 0;
            for (let i = 0; i < numMonths; i++) {
                const x = i - midpoint;
                const value = Math.exp(-(x * x) / (2 * stdDev * stdDev));
                distribution.push(value);
                total += value;
            }
            
            // Normalize to sum to 1.0
            return distribution.map(v => v / total);
        }

        /**
         * Calculates bell curve distribution for hours across years
         */
        function calculateBellCurveDistribution(years) {
            if (years === 1) return [1];
            
            const distribution = [];
            const mean = (years - 1) / 2;
            const stdDev = years / 4;
            
            let total = 0;
            for (let i = 0; i < years; i++) {
                // Normal distribution formula
                const x = i;
                const value = Math.exp(-Math.pow(x - mean, 2) / (2 * Math.pow(stdDev, 2)));
                distribution.push(value);
                total += value;
            }
            
            // Normalize to sum to 1
            return distribution.map(v => v / total);
        }

        /**
         * Renders the escalation breakdown table
         * Now shows Raw Labor Cost instead of Hours (Cost-based escalation)
         */
        function renderEscalationTable() {
            const tbody = document.getElementById('escalation-breakdown-tbody');
            if (!tbody) return;
            
            let html = '';
            let totalRawLaborCost = 0;
            let totalAmount = 0;
            let totalPercent = 0;
            
            escalationData.yearlyBreakdown.forEach(row => {
                totalRawLaborCost += row.rawLaborCost || 0;
                totalAmount += row.escalationAmount;
                totalPercent += row.costPercent || row.hourPercent;
                
                const manualValue = row.manualOverride !== undefined && row.manualOverride !== null && row.manualOverride !== '' 
                    ? parseFloat(row.manualOverride).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                    : '';
                
                // Check if this year has a manual cost distribution override
                const hasCostOverride = escalationData.hourDistributionOverrides && 
                    escalationData.hourDistributionOverrides[row.year] !== undefined;
                const costPercentValue = hasCostOverride 
                    ? escalationData.hourDistributionOverrides[row.year] 
                    : (row.costPercent || row.hourPercent);
                
                // Highlight Year 1 with no escalation
                const isNoEscalation = row.effectiveYears === 0;
                const rowStyle = isNoEscalation ? 'style="background-color: rgba(76, 175, 80, 0.1);"' : '';
                const escalationNote = isNoEscalation ? '<span style="font-size: 9px; color: #4CAF50;"> (Baseline)</span>' : '';
                const effectiveYearsDisplay = row.effectiveYears === 0 ? 'N/A' : row.effectiveYears + ' yr' + (row.effectiveYears > 1 ? 's' : '');
                
                html += `
                    <tr ${rowStyle}>
                        <td>Year ${row.year}${escalationNote}</td>
                        <td>$${Math.round(row.rawLaborCost || 0).toLocaleString()}</td>
                        <td>
                            <input type="number" value="${costPercentValue.toFixed(1)}" min="0" max="100" step="0.1" 
                                   style="width: 60px; text-align: right; ${hasCostOverride ? 'background: #fff3cd; border-color: #ffc107;' : ''}"
                                   onchange="updateYearHourDistribution(${row.year}, this.value)"
                                   title="Edit to override bell curve distribution">%
                        </td>
                        <td>${effectiveYearsDisplay}</td>
                        <td>
                            <input type="number" value="${row.rate}" min="0" max="20" step="0.1" 
                                   onchange="updateYearEscalationRate(${row.year}, this.value)" ${isNoEscalation ? 'disabled style="background: #f0f0f0;"' : ''}>
                        </td>
                        <td>${(row.compoundedFactor * 100).toFixed(2)}%</td>
                        <td>$${Math.round(row.escalationAmount).toLocaleString()}</td>
                        <td>
                            <input type="text" value="${manualValue}" placeholder="${isNoEscalation ? 'N/A' : 'Auto'}" 
                                   onchange="updateYearManualOverride(${row.year}, this.value)" ${isNoEscalation ? 'disabled style="background: #f0f0f0;"' : ''}>
                        </td>
                    </tr>
                `;
            });
            
            tbody.innerHTML = html;
            
            // Update totals - show warning if percentages don't sum to 100%
            const percentWarning = Math.abs(totalPercent - 100) > 0.5 ? 
                ` <span style="color: #ff9800; font-size: 10px;">(${totalPercent.toFixed(1)}%)</span>` : '';
            // Show total raw labor cost instead of hours
            document.getElementById('escalation-modal-total-hours').textContent = '$' + Math.round(totalRawLaborCost).toLocaleString();
            document.getElementById('escalation-modal-total-amount').textContent = '$' + Math.round(totalAmount).toLocaleString();
        }

        /**
         * Updates the escalation rate for a specific year
         */
        function updateYearEscalationRate(year, value) {
            // For now, just recalculate with the base rate
            // Could be extended to support per-year rates
            recalculateEscalation();
        }

        /**
         * Updates the hour distribution percentage override for a specific year
         */
        function updateYearHourDistribution(year, value) {
            if (!escalationData.hourDistributionOverrides) {
                escalationData.hourDistributionOverrides = {};
            }
            
            const numValue = parseFloat(value);
            if (isNaN(numValue) || numValue < 0 || numValue > 100) {
                delete escalationData.hourDistributionOverrides[year];
            } else {
                escalationData.hourDistributionOverrides[year] = numValue;
            }
            
            // Recalculate with the new distribution
            recalculateEscalationWithOverrides();
        }

        /**
         * Updates the manual override for a specific year
         */
        function updateYearManualOverride(year, value) {
            if (value === '' || value === null) {
                delete escalationData.manualOverrides[year];
            } else {
                // Remove formatting and store as number
                escalationData.manualOverrides[year] = parseFloat(value.replace(/[$,]/g, '')) || 0;
            }
            recalculateEscalation();
        }

        /**
         * Recalculate escalation using manual cost distribution overrides
         * Uses Raw Labor Cost for Directs + Indirects (Cost-based escalation)
         */
        function recalculateEscalationWithOverrides() {
            const overrides = escalationData.hourDistributionOverrides || {};
            const years = escalationData.years || 3;
            const baseRate = escalationData.baseRate || 5;
            
            // Get total RAW LABOR for Directs and Indirects (Cost-based escalation)
            const directsRawLabor = parseFloat(document.getElementById('unified-direct-total-raw-labor')?.textContent?.replace(/[$,]/g, '')) || 0;
            const indirectsRawLabor = parseFloat(document.getElementById('unified-indirect-total-raw-labor')?.textContent?.replace(/[$,]/g, '')) || 0;
            const baseCost = directsRawLabor + indirectsRawLabor;
            
            // Calculate distribution - use overrides where set, bell curve otherwise
            const bellCurve = calculateBellCurveDistribution(years);
            let distribution = [];
            let overrideTotal = 0;
            let bellCurvePortions = [];
            
            for (let i = 0; i < years; i++) {
                const year = i + 1;
                if (overrides[year] !== undefined) {
                    distribution[i] = overrides[year] / 100;
                    overrideTotal += overrides[year];
                } else {
                    distribution[i] = null; // Will be filled with adjusted bell curve
                    bellCurvePortions.push({ index: i, bellValue: bellCurve[i] });
                }
            }
            
            // Adjust remaining bell curve portions to fill the gap
            const remainingPercent = (100 - overrideTotal) / 100;
            const bellCurveSum = bellCurvePortions.reduce((sum, p) => sum + p.bellValue, 0);
            
            for (const portion of bellCurvePortions) {
                if (bellCurveSum > 0) {
                    distribution[portion.index] = (portion.bellValue / bellCurveSum) * remainingPercent;
                } else {
                    distribution[portion.index] = remainingPercent / bellCurvePortions.length;
                }
            }
            
            // Get NTP date for escalation calculation
            const ntpDateInput = document.getElementById('escalation-ntp-date');
            const ntpDate = ntpDateInput?.value ? new Date(ntpDateInput.value) : new Date();
            const ntpMonth = ntpDate.getMonth();
            const ntpYear = ntpDate.getFullYear();
            
            let firstEscalationDate;
            if (ntpMonth < 2) {
                firstEscalationDate = new Date(ntpYear, 2, 1);
            } else {
                firstEscalationDate = new Date(ntpYear + 1, 2, 1);
            }
            
            // Recalculate yearly breakdown with new distribution
            escalationData.yearlyBreakdown = [];
            let totalEscalation = 0;
            
            for (let i = 0; i < years; i++) {
                const year = i + 1;
                const yearHours = totalHours * distribution[i];
                const hourPercent = distribution[i] * 100;
                const yearBaseCost = baseCost * distribution[i];
                
                // Determine if this year has escalation
                const effectiveYears = year === 1 ? 0 : year - 1;
                const compoundedFactor = effectiveYears > 0 ? Math.pow(1 + (baseRate / 100), effectiveYears) - 1 : 0;
                
                // Check for manual override
                const manualOverride = escalationData.manualOverrides?.[year];
                let escalationAmount;
                
                if (manualOverride !== undefined && manualOverride !== null && manualOverride !== '') {
                    escalationAmount = parseFloat(manualOverride) || 0;
                } else {
                    escalationAmount = yearBaseCost * compoundedFactor;
                }
                
                totalEscalation += escalationAmount;
                
                escalationData.yearlyBreakdown.push({
                    year: year,
                    hours: yearHours,
                    hourPercent: hourPercent,
                    rate: baseRate,
                    effectiveYears: effectiveYears,
                    compoundedFactor: compoundedFactor,
                    escalationAmount: escalationAmount,
                    manualOverride: manualOverride
                });
            }
            
            escalationData.totalCost = totalEscalation;
            
            // Re-render table and chart
            renderEscalationTable();
            renderEscalationChart();
        }

        /**
         * Resets all hour distribution overrides back to bell curve
         */
        function resetHourDistribution() {
            escalationData.hourDistributionOverrides = {};
            recalculateEscalation();
        }

        /**
         * Renders the bell curve chart with monthly data
         */
        function renderEscalationChart() {
            const canvas = document.getElementById('escalation-bell-curve-chart');
            if (!canvas) return;
            
            const ctx = canvas.getContext('2d');
            
            // Destroy existing chart
            if (escalationChart) {
                escalationChart.destroy();
            }
            
            // Use monthly breakdown for chart (with month/year labels)
            const monthlyData = escalationData.monthlyBreakdown || [];
            if (monthlyData.length === 0) return;
            
            const labels = monthlyData.map(row => row.label);
            // Use raw labor COST distribution instead of hours
            const costData = monthlyData.map(row => Math.round(row.rawLaborCost));
            const escalationData2 = monthlyData.map(row => Math.round(row.escalationAmount));
            
            // Calculate max values for better scaling
            const maxCost = Math.max(...costData);
            const maxEscalation = Math.max(...escalationData2);
            
            // Add 10% padding to the max for better visualization
            const costMax = Math.ceil(maxCost * 1.1);
            const escalationMax = Math.ceil(maxEscalation * 1.1);
            
            // Reduce point size for many data points
            const pointRadius = monthlyData.length > 24 ? 2 : monthlyData.length > 12 ? 3 : 5;
            
            escalationChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [
                        {
                            label: 'Raw Labor Cost Distribution ($)',
                            data: costData,
                            backgroundColor: 'rgba(92, 107, 192, 0.7)',
                            borderColor: 'rgba(92, 107, 192, 1)',
                            borderWidth: 1,
                            borderRadius: 2,
                            yAxisID: 'y'
                        },
                        {
                            label: 'Escalation Cost ($)',
                            data: escalationData2,
                            type: 'line',
                            borderColor: 'rgba(255, 193, 7, 1)',
                            backgroundColor: 'rgba(255, 193, 7, 0.15)',
                            fill: true,
                            tension: 0.4,
                            borderWidth: 2,
                            pointRadius: pointRadius,
                            pointBackgroundColor: 'rgba(255, 193, 7, 1)',
                            pointBorderColor: '#fff',
                            pointBorderWidth: 1,
                            yAxisID: 'y1'
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: {
                        mode: 'index',
                        intersect: false
                    },
                    plugins: {
                        legend: {
                            position: 'top',
                            labels: {
                                color: '#e0e0e0',
                                font: {
                                    size: 11
                                },
                                padding: 15
                            }
                        },
                        tooltip: {
                            backgroundColor: 'rgba(30, 30, 30, 0.95)',
                            titleColor: '#ffd700',
                            bodyColor: '#e0e0e0',
                            borderColor: '#ffd700',
                            borderWidth: 1,
                            padding: 12,
                            callbacks: {
                                title: function(context) {
                                    const idx = context[0].dataIndex;
                                    const monthData = monthlyData[idx];
                                    return `${monthData.labelFull} (FY ${monthData.fiscalYear})`;
                                },
                                label: function(context) {
                                    const idx = context.dataIndex;
                                    const monthData = monthlyData[idx];
                                    if (context.dataset.label.includes('Raw Labor')) {
                                        return `Raw Labor: $${context.raw.toLocaleString()} (${monthData.costPercent.toFixed(1)}%)`;
                                    } else {
                                        const escalYears = monthData.escalationYears;
                                        return `Escalation: $${context.raw.toLocaleString()} (${escalYears} yr${escalYears !== 1 ? 's' : ''})`;
                                    }
                                }
                            }
                        }
                    },
                    scales: {
                        x: {
                            title: {
                                display: true,
                                text: 'Month / Year',
                                color: '#b0b0b0'
                            },
                            ticks: {
                                color: '#b0b0b0',
                                maxRotation: 0,
                                minRotation: 0,
                                font: {
                                    size: monthlyData.length > 48 ? 7 : monthlyData.length > 24 ? 8 : 9
                                },
                                // Show every Nth label based on duration (shorter labels = can show more)
                                callback: function(value, index) {
                                    const skipInterval = monthlyData.length > 60 ? 6 : monthlyData.length > 48 ? 4 : monthlyData.length > 36 ? 3 : monthlyData.length > 24 ? 2 : 1;
                                    return index % skipInterval === 0 ? this.getLabelForValue(value) : '';
                                }
                            },
                            grid: {
                                color: 'rgba(255, 255, 255, 0.1)'
                            }
                        },
                        y: {
                            type: 'linear',
                            position: 'left',
                            beginAtZero: true,
                            max: costMax > 0 ? costMax : undefined,
                            title: {
                                display: true,
                                text: 'Raw Labor Cost ($)',
                                color: '#5c6bc0'
                            },
                            ticks: {
                                color: '#5c6bc0',
                                callback: function(value) {
                                    return '$' + value.toLocaleString();
                                }
                            },
                            grid: {
                                color: 'rgba(92, 107, 192, 0.2)'
                            }
                        },
                        y1: {
                            type: 'linear',
                            position: 'right',
                            beginAtZero: true,
                            max: escalationMax > 0 ? escalationMax : undefined,
                            title: {
                                display: true,
                                text: 'Escalation ($)',
                                color: '#ffc107'
                            },
                            ticks: {
                                color: '#ffc107',
                                callback: function(value) {
                                    return '$' + value.toLocaleString();
                                }
                            },
                            grid: {
                                drawOnChartArea: false
                            }
                        }
                    }
                }
            });
        }

        /**
         * Resets escalation to default values
         */
        function resetEscalationToDefault() {
            escalationData.manualOverrides = {};
            const escalationRateInput = document.getElementById('unified-escalation');
            document.getElementById('escalation-base-rate').value = parseFloat(escalationRateInput?.value) || 5;
            recalculateEscalation();
        }

        /**
         * Applies escalation changes to the main calculation
         */
        function applyEscalationChanges() {
            // Update the main escalation rate
            const baseRate = parseFloat(document.getElementById('escalation-base-rate')?.value) || 5;
            const escalationRateInput = document.getElementById('unified-escalation');
            if (escalationRateInput) {
                escalationRateInput.value = baseRate;
            }
            
            // Update the escalation total in the main table (now in the margin column)
            const escalationMarginCell = document.getElementById('escalation-total-margin');
            if (escalationMarginCell) {
                escalationMarginCell.innerHTML = '$' + Math.round(escalationData.totalCost).toLocaleString() + 
                    ' <button class="escalation-details-btn" onclick="openEscalationModal()" title="View Escalation Breakdown">📊</button>';
            }
            
            // Close the modal
            closeEscalationModal();
            
            // Trigger recalculation of the main table
            if (typeof calculateMHEstimates === 'function') {
                calculateMHEstimates();
            }
        }

        /**
         * Shows the recovery modal with saved data preview
         */
        function showRecoveryModal(savedData) {
            const modal = document.getElementById('recovery-modal');
            const preview = document.getElementById('recovery-preview');
            
            if (!modal || !preview) return;
            
            const pd = savedData.projectData;
            const totalBudget = Object.values(pd.budgets || {}).reduce((sum, b) => sum + (parseFloat(b) || 0), 0);
            
            preview.innerHTML = `
                <div class="recovery-preview-item">
                    <span class="recovery-preview-label">Last saved:</span>
                    <span class="recovery-preview-value">${formatTimestamp(savedData.timestamp)}</span>
                </div>
                <div class="recovery-preview-item">
                    <span class="recovery-preview-label">Step:</span>
                    <span class="recovery-preview-value">${savedData.currentStep} of 6</span>
                </div>
                <div class="recovery-preview-item">
                    <span class="recovery-preview-label">Phases:</span>
                    <span class="recovery-preview-value">${pd.phases.length > 0 ? pd.phases.join(', ') : 'None'}</span>
                </div>
                <div class="recovery-preview-item">
                    <span class="recovery-preview-label">Disciplines:</span>
                    <span class="recovery-preview-value">${pd.disciplines.length || 0} selected</span>
                </div>
                <div class="recovery-preview-item">
                    <span class="recovery-preview-label">Packages:</span>
                    <span class="recovery-preview-value">${pd.packages.length > 0 ? pd.packages.join(', ') : 'None'}</span>
                </div>
                <div class="recovery-preview-item">
                    <span class="recovery-preview-label">Total Budget:</span>
                    <span class="recovery-preview-value">${totalBudget > 0 ? formatCurrency(totalBudget) : 'Not set'}</span>
                </div>
                ${pd.projectScope ? `
                <div class="recovery-preview-item">
                    <span class="recovery-preview-label">Project Scope:</span>
                    <span class="recovery-preview-value">✓ From RFP Analysis</span>
                </div>
                ` : ''}
            `;
            
            modal.classList.add('open');
        }

        /**
         * Dismisses the recovery modal without action
         */
        function dismissRecovery() {
            document.getElementById('recovery-modal')?.classList.remove('open');
        }

        /**
         * Discards saved data and starts fresh
         */
        function discardRecovery() {
            localStorage.removeItem(STORAGE_KEY);
            dismissRecovery();
            console.log('Saved data discarded');
        }

        /**
         * Restores saved data
         */
        function restoreRecovery() {
            const savedData = loadFromLocalStorage();
            if (!savedData) {
                dismissRecovery();
                return;
            }
            
            // Restore projectData
            projectData = { ...projectData, ...savedData.projectData };
            
            // Restore form values
            if (savedData.formState) {
                const phasesInput = document.getElementById('phases-input');
                const packagesInput = document.getElementById('packages-input');
                if (phasesInput && savedData.formState.phases) {
                    phasesInput.value = savedData.formState.phases;
                }
                if (packagesInput && savedData.formState.packages) {
                    packagesInput.value = savedData.formState.packages;
                }
            }
            
            // Restore discipline selections
            if (savedData.projectData.disciplines.length > 0) {
                allDisciplines.forEach(d => {
                    d.selected = savedData.projectData.disciplines.includes(d.name);
                });
                initDisciplines();
            }
            
            // Navigate to saved step (default to Benchmarking if not saved)
            currentStep = savedData.currentStep || 4;
            showStep(currentStep);
            updateProgress();
            
            dismissRecovery();
            updateStatus('SESSION RESTORED');
            console.log('Session restored from:', new Date(savedData.timestamp).toLocaleString());
        }

        /**
         * Clears all saved data (for use after successful WBS generation or manual clear)
         */
        function clearSavedData() {
            localStorage.removeItem(STORAGE_KEY);
            console.log('Saved data cleared');
        }

        /**
         * Checks for saved data on page load
         */
        function checkForSavedData() {
            const savedData = loadFromLocalStorage();
            if (savedData && hasMeaningfulData(savedData)) {
                // Only show recovery if data is less than 7 days old
                const ageMs = Date.now() - savedData.timestamp;
                const maxAgeMs = 7 * 24 * 60 * 60 * 1000; // 7 days
                
                if (ageMs < maxAgeMs) {
                    showRecoveryModal(savedData);
                } else {
                    console.log('Saved data too old, discarding');
                    clearSavedData();
                }
            }
        }

        // ============================================
        // MULTI-PROJECT MANAGER
        // ============================================
        
        const PROJECTS_STORAGE_KEY = 'wbs_saved_projects';

        // ============================================
        // REPORTS PANEL
        // ============================================

        /**
         * Opens the reports panel modal
         */
        function openReportsPanel() {
            // Show/hide RFP section based on whether RFP data exists
            const rfpSection = document.getElementById('reports-rfp-section');
            if (rfpSection) {
                const hasRfpData = rfpState && rfpState.extractedData && 
                    (rfpState.extractedData.disciplines?.length > 0 || rfpState.extractedData.scope);
                rfpSection.classList.toggle('hidden', !hasRfpData);
            }
            
            document.getElementById('reports-modal').classList.add('open');
        }

        /**
         * Closes the reports panel modal
         */
        function closeReportsPanel() {
            document.getElementById('reports-modal').classList.remove('open');
        }

        /**
         * Shows/hides the reports button based on results visibility
         */
        function updateReportsButtonVisibility() {
            const resultsVisible = !document.getElementById('results-section').classList.contains('hidden');
            const reportsBtn = document.getElementById('reports-btn');
            if (reportsBtn) {
                reportsBtn.classList.toggle('hidden', !resultsVisible);
            }
        }

        /**
         * Generates a shareable URL with project data encoded
         */
        function shareProjectUrl() {
            try {
                // Create a minimal version of project data
                const shareData = {
                    phases: projectData.phases,
                    disciplines: projectData.disciplines,
                    packages: projectData.packages,
                    budgets: projectData.budgets
                };
                
                const encoded = btoa(JSON.stringify(shareData));
                const url = window.location.origin + window.location.pathname + '?data=' + encoded;
                
                navigator.clipboard.writeText(url).then(() => {
                    alert('Share link copied to clipboard!\n\nNote: Link contains basic project structure only.');
                }).catch(() => {
                    prompt('Copy this share link:', url);
                });
            } catch (error) {
                alert('Unable to generate share link. Project data may be too large.');
            }
        }

        /**
         * Opens the project manager modal
         */
        function openProjectManager() {
            document.getElementById('projects-modal').classList.add('open');
            populateProjectsList();
            
            // Pre-fill save name if project has meaningful data
            const saveInput = document.getElementById('project-save-name');
            if (projectData.phases.length > 0) {
                const defaultName = projectData.phases[0] + ' Project';
                saveInput.placeholder = defaultName;
            }
        }

        /**
         * Closes the project manager modal
         */
        function closeProjectManager() {
            document.getElementById('projects-modal').classList.remove('open');
        }

        /**
         * Gets all saved projects from localStorage
         */
        function getSavedProjects() {
            try {
                const saved = localStorage.getItem(PROJECTS_STORAGE_KEY);
                return saved ? JSON.parse(saved) : [];
            } catch (e) {
                console.error('Failed to load saved projects:', e);
                return [];
            }
        }

        /**
         * Saves the projects list to localStorage
         */
        function saveProjectsList(projects) {
            localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(projects));
        }

        /**
         * Saves the current project with a name
         */
        function saveNamedProject() {
            const nameInput = document.getElementById('project-save-name');
            let name = nameInput.value.trim();
            
            if (!name) {
                name = projectData.phases.length > 0 
                    ? projectData.phases[0] + ' Project' 
                    : 'Untitled Project';
            }
            
            // Check if project has data
            if (!hasMeaningfulData({ projectData })) {
                alert('No project data to save. Please complete some wizard steps first.');
                return;
            }
            
            const projects = getSavedProjects();
            
            // Check for existing project with same name
            const existingIdx = projects.findIndex(p => p.name === name);
            if (existingIdx >= 0) {
                if (!confirm(`A project named "${name}" already exists. Overwrite it?`)) {
                    return;
                }
                projects.splice(existingIdx, 1);
            }
            
            // Create project snapshot
            const totalBudget = Object.values(projectData.budgets).reduce((sum, b) => sum + (parseFloat(b) || 0), 0);
            
            const projectSnapshot = {
                id: Date.now().toString(),
                name: name,
                savedAt: Date.now(),
                currentStep: currentStep,
                projectData: JSON.parse(JSON.stringify(projectData)), // Deep clone
                summary: {
                    phases: projectData.phases.length,
                    disciplines: projectData.disciplines.length,
                    packages: projectData.packages.length,
                    totalBudget: totalBudget
                }
            };
            
            projects.unshift(projectSnapshot);
            saveProjectsList(projects);
            
            nameInput.value = '';
            populateProjectsList();
            
            updateStatus(`SAVED: ${name}`);
        }

        /**
         * Populates the projects list in the modal
         */
        function populateProjectsList() {
            const list = document.getElementById('projects-list');
            const projects = getSavedProjects();
            
            if (projects.length === 0) {
                list.innerHTML = `
                    <div class="projects-empty">
                        <div style="font-size: 24px; margin-bottom: 8px;">📂</div>
                        No saved projects yet.<br>
                        Save your current project using the form above.
                    </div>
                `;
                return;
            }
            
            list.innerHTML = projects.map(project => `
                <div class="card-base project-item" data-id="${project.id}">
                    <input type="checkbox" class="project-item-checkbox" onchange="updateCompareView()">
                    <div class="project-item-info">
                        <div class="project-item-name">${escapeHtml(project.name)}</div>
                        <div class="project-item-meta">
                            <span>📅 ${formatTimestamp(project.savedAt)}</span>
                            <span>📊 ${project.summary.disciplines} disciplines</span>
                            <span>💰 ${formatCurrency(project.summary.totalBudget)}</span>
                        </div>
                    </div>
                    <div class="project-item-actions">
                        <button class="project-item-btn" onclick="loadProject('${project.id}')">Load</button>
                        <button class="project-item-btn" onclick="duplicateProject('${project.id}')">Clone</button>
                        <button class="project-item-btn delete" onclick="deleteProject('${project.id}')">Delete</button>
                    </div>
                </div>
            `).join('');
        }

        /**
         * Loads a saved project
         */
        function loadProject(projectId) {
            const projects = getSavedProjects();
            const project = projects.find(p => p.id === projectId);
            
            if (!project) {
                alert('Project not found.');
                return;
            }
            
            // Confirm if there's current data
            if (hasMeaningfulData({ projectData })) {
                if (!confirm(`Load "${project.name}"? Your current unsaved work will be lost.`)) {
                    return;
                }
            }
            
            // Load project data
            projectData = JSON.parse(JSON.stringify(project.projectData));
            currentStep = project.currentStep || 4;
            
            // Update UI
            document.getElementById('phases-input').value = projectData.phases.join(', ');
            document.getElementById('packages-input').value = projectData.packages.join(', ');
            
            // Update discipline selections
            allDisciplines.forEach(d => {
                d.selected = projectData.disciplines.includes(d.name);
            });
            initDisciplines();
            
            // Navigate to saved step
            showStep(currentStep);
            updateProgress();
            
            closeProjectManager();
            triggerAutosave();
            updateStatus(`LOADED: ${project.name}`);
        }

        /**
         * Duplicates a saved project
         */
        function duplicateProject(projectId) {
            const projects = getSavedProjects();
            const project = projects.find(p => p.id === projectId);
            
            if (!project) return;
            
            const newProject = JSON.parse(JSON.stringify(project));
            newProject.id = Date.now().toString();
            newProject.name = project.name + ' (Copy)';
            newProject.savedAt = Date.now();
            
            projects.unshift(newProject);
            saveProjectsList(projects);
            populateProjectsList();
        }

        /**
         * Deletes a saved project
         */
        function deleteProject(projectId) {
            const projects = getSavedProjects();
            const project = projects.find(p => p.id === projectId);
            
            if (!project) return;
            
            if (!confirm(`Delete "${project.name}"? This cannot be undone.`)) {
                return;
            }
            
            const filtered = projects.filter(p => p.id !== projectId);
            saveProjectsList(filtered);
            populateProjectsList();
            updateCompareView();
        }

        /**
         * Updates the compare view based on selected projects
         */
        function updateCompareView() {
            const checkboxes = document.querySelectorAll('.project-item-checkbox:checked');
            const compareSection = document.getElementById('compare-section');
            const compareView = document.getElementById('compare-view');
            
            if (checkboxes.length < 2) {
                compareSection.classList.add('hidden');
                return;
            }
            
            compareSection.classList.remove('hidden');
            
            const projects = getSavedProjects();
            const selectedProjects = [];
            
            checkboxes.forEach(cb => {
                const projectItem = cb.closest('.project-item');
                const projectId = projectItem.dataset.id;
                const project = projects.find(p => p.id === projectId);
                if (project) selectedProjects.push(project);
            });
            
            compareView.innerHTML = selectedProjects.map(project => `
                <div class="compare-card">
                    <div class="compare-card-title">${escapeHtml(project.name)}</div>
                    <div class="compare-stat">
                        <span class="compare-stat-label">Total Budget</span>
                        <span class="compare-stat-value">${formatCurrency(project.summary.totalBudget)}</span>
                    </div>
                    <div class="compare-stat">
                        <span class="compare-stat-label">Phases</span>
                        <span class="compare-stat-value">${project.summary.phases}</span>
                    </div>
                    <div class="compare-stat">
                        <span class="compare-stat-label">Disciplines</span>
                        <span class="compare-stat-value">${project.summary.disciplines}</span>
                    </div>
                    <div class="compare-stat">
                        <span class="compare-stat-label">Packages</span>
                        <span class="compare-stat-value">${project.summary.packages}</span>
                    </div>
                    <div class="compare-stat">
                        <span class="compare-stat-label">Saved</span>
                        <span class="compare-stat-value">${formatTimestamp(project.savedAt)}</span>
                    </div>
                </div>
            `).join('');
        }

        /**
         * Escapes HTML characters to prevent XSS
         */
        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        // Discipline list with pre-selected items
        const allDisciplines = [
            { name: 'Structures', selected: true },
            { name: 'Design PM', selected: true },
            { name: 'Civil', selected: false },
            { name: 'Drainage', selected: false },
            { name: 'Electrical', selected: false },
            { name: 'Environmental', selected: false },
            { name: 'Traffic', selected: false },
            { name: 'ITS', selected: false },
            { name: 'Mechanical', selected: false },
            { name: 'Geotechnical', selected: false },
            { name: 'Survey', selected: false },
            { name: 'Landscape', selected: false },
            { name: 'Utilities', selected: false },
            { name: 'Lighting', selected: false },
            { name: 'Pavement', selected: false },
            { name: 'Bridges', selected: false },
            { name: 'H&H', selected: false },
            { name: 'Communications', selected: false },
            { name: 'Architecture', selected: false },
            { name: 'Systems', selected: false }
        ];

        // Example budgets [in the future we will use a database to get the budgets]
        const exampleBudgets = {
            'Structures': 450000,
            'Design PM': 180000,
            'Civil': 320000,
            'Drainage': 95000,
            'Electrical': 210000,
            'Environmental': 85000,
            'Traffic': 140000,
            'ITS': 125000,
            'Mechanical': 175000,
            'Geotechnical': 110000,
            'Survey': 65000,
            'Landscape': 55000,
            'Utilities': 90000,
            'Lighting': 75000,
            'Pavement': 280000,
            'Bridges': 520000,
            'H&H': 120000,
            'Communications': 95000,
            'Architecture': 150000,
            'Systems': 180000
        };

        // Default claiming scheme
        const defaultClaiming = [10, 15, 25, 30, 20];

        // Claiming scheme presets
        const claimingSchemes = {
            frontLoaded: {
                name: 'Front-Loaded',
                description: 'Higher % early, declining',
                baseline: [30, 25, 20, 15, 10],
                pattern: 'descending'
            },
            backLoaded: {
                name: 'Back-Loaded',
                description: 'Lower % early, increasing',
                baseline: [10, 15, 20, 25, 30],
                pattern: 'ascending'
            },
            bellCurve: {
                name: 'Bell Curve',
                description: 'Peak in middle',
                baseline: [10, 20, 40, 20, 10],
                pattern: 'bell'
            },
            linear: {
                name: 'Linear/Even',
                description: 'Equal distribution',
                baseline: [20, 20, 20, 20, 20],
                pattern: 'equal'
            }
        };

        // ============================================
        // PROJECT TEMPLATES
        // ============================================
        
        const projectTemplates = {
            highway: {
                id: 'highway',
                name: 'Highway Reconstruction',
                icon: '🛣️',
                description: 'Highway widening, reconstruction, or improvement project',
                projectType: 'Highway/Roadway',
                phases: ['Base Design', 'ESDC', 'TSCD'],
                disciplines: ['Design PM', 'Civil', 'Drainage', 'Traffic', 'Survey', 'Pavement', 'Utilities', 'Environmental', 'Lighting'],
                packages: ['Preliminary', 'Interim', 'Final', 'RFC'],
                constructionCost: 10000000,
                designFeePercent: 12,
                claimingScheme: 'bellCurve'
            },
            bridge: {
                id: 'bridge',
                name: 'Bridge Replacement',
                icon: '🌉',
                description: 'Bridge design, replacement, or rehabilitation project',
                projectType: 'Bridge',
                phases: ['Base Design', 'ESDC', 'TSCD'],
                disciplines: ['Design PM', 'Structures', 'Bridges', 'Geotechnical', 'Civil', 'Drainage', 'H&H', 'Survey', 'Environmental'],
                packages: ['Preliminary', 'Interim', 'Final', 'RFC'],
                constructionCost: 15000000,
                designFeePercent: 15,
                claimingScheme: 'bellCurve'
            },
            drainage: {
                id: 'drainage',
                name: 'Drainage Improvement',
                icon: '💧',
                description: 'Stormwater management or drainage infrastructure project',
                projectType: 'Drainage/Utilities',
                phases: ['Base Design', 'Final Design'],
                disciplines: ['Design PM', 'Drainage', 'H&H', 'Civil', 'Environmental', 'Survey', 'Utilities', 'Geotechnical'],
                packages: ['Preliminary', 'Final', 'RFC'],
                constructionCost: 5000000,
                designFeePercent: 12,
                claimingScheme: 'linear'
            },
            intersection: {
                id: 'intersection',
                name: 'Intersection Improvement',
                icon: '🚦',
                description: 'Traffic signal, intersection, or safety improvement project',
                projectType: 'Highway/Roadway',
                phases: ['Base Design', 'Final Design'],
                disciplines: ['Design PM', 'Civil', 'Traffic', 'Lighting', 'Electrical', 'Drainage', 'Survey', 'Utilities'],
                packages: ['Preliminary', 'Final', 'RFC'],
                constructionCost: 3000000,
                designFeePercent: 15,
                claimingScheme: 'bellCurve'
            },
            multiDiscipline: {
                id: 'multiDiscipline',
                name: 'Multi-Discipline Infrastructure',
                icon: '🏗️',
                description: 'Large-scale project with multiple engineering disciplines',
                projectType: 'Highway/Roadway',
                phases: ['Base Design', 'ESDC', 'TSCD', 'Closeout'],
                disciplines: ['Design PM', 'Structures', 'Civil', 'Drainage', 'Traffic', 'ITS', 'Electrical', 'Environmental', 'Survey', 'Utilities', 'Lighting', 'Pavement', 'Geotechnical'],
                packages: ['Preliminary', 'Interim', 'Final', 'RFC', 'As-Built'],
                constructionCost: 50000000,
                designFeePercent: 10,
                claimingScheme: 'bellCurve'
            },
            transit: {
                id: 'transit',
                name: 'Transit/Rail Station',
                icon: '🚆',
                description: 'Transit station, rail crossing, or transit infrastructure',
                projectType: 'Bridge',
                phases: ['Conceptual Design', 'Preliminary Design', 'Final Design'],
                disciplines: ['Design PM', 'Structures', 'Architecture', 'Civil', 'Electrical', 'Mechanical', 'Systems', 'Traffic', 'Environmental'],
                packages: ['30% Design', '60% Design', '90% Design', 'Final'],
                constructionCost: 25000000,
                designFeePercent: 12,
                claimingScheme: 'bellCurve'
            }
        };

        /**
         * Toggles the template selector visibility
         */
        function toggleTemplateSelector() {
            const selector = document.querySelector('.template-selector');
            const body = document.getElementById('template-body');
            
            selector.classList.toggle('expanded');
            body.classList.toggle('hidden');
            
            // Populate templates on first open
            if (!body.classList.contains('hidden') && body.innerHTML.trim() === '') {
                populateTemplates();
            }
        }

        /**
         * Populates the template grid with available templates
         */
        function populateTemplates() {
            const grid = document.getElementById('template-grid');
            
            grid.innerHTML = Object.values(projectTemplates).map(template => `
                <div class="card-base template-card" onclick="applyTemplate('${template.id}')">
                    <div class="card-base-icon template-card-icon">${template.icon}</div>
                    <div class="card-base-title">${template.name}</div>
                    <div class="card-base-desc">${template.description}</div>
                    <div class="template-card-stats">
                        <div class="template-card-stat">
                            <span>${template.phases.length}</span> phases
                        </div>
                        <div class="template-card-stat">
                            <span>${template.disciplines.length}</span> disciplines
                        </div>
                        <div class="template-card-stat">
                            <span>${template.packages.length}</span> packages
                        </div>
                    </div>
                </div>
            `).join('');
        }

        /**
         * Applies a template to populate the wizard
         */
        function applyTemplate(templateId) {
            const template = projectTemplates[templateId];
            if (!template) return;
            
            // Confirm if there's existing data
            const hasData = projectData.phases.length > 0 || 
                           projectData.disciplines.length > 0 || 
                           Object.keys(projectData.budgets).length > 0;
            
            if (hasData) {
                if (!confirm(`This will replace your current project data with the "${template.name}" template. Continue?`)) {
                    return;
                }
            }
            
            // Apply template data
            projectData.phases = [...template.phases];
            projectData.packages = [...template.packages];
            projectData.disciplines = [...template.disciplines];
            
            // Set calculator values
            projectData.calculator.totalConstructionCost = template.constructionCost;
            projectData.calculator.designFeePercent = template.designFeePercent;
            projectData.calculator.projectType = template.projectType;
            projectData.calculator.isCalculated = false;
            
            // Update form inputs
            document.getElementById('phases-input').value = template.phases.join(', ');
            document.getElementById('packages-input').value = template.packages.join(', ');
            
            // Update discipline grid
            allDisciplines.forEach(d => {
                d.selected = template.disciplines.includes(d.name);
            });
            initDisciplines();
            
            // Initialize claiming with the template's scheme
            const scheme = claimingSchemes[template.claimingScheme];
            if (scheme) {
                const adjustedScheme = adjustSchemeToPackageCount(template.claimingScheme, template.packages.length);
                template.disciplines.forEach(disc => {
                    template.packages.forEach((pkg, i) => {
                        const key = `${disc}-${pkg}`;
                        projectData.claiming[key] = adjustedScheme[i];
                    });
                });
            }
            
            // Initialize dates (spread across typical project duration)
            const today = new Date();
            const monthsPerPhase = Math.ceil(12 / template.phases.length);
            template.disciplines.forEach(disc => {
                template.packages.forEach((pkg, i) => {
                    const key = `${disc}-${pkg}`;
                    const startOffset = i * (monthsPerPhase * 30 / template.packages.length);
                    const endOffset = startOffset + (monthsPerPhase * 30 / template.packages.length) - 1;
                    
                    const startDate = new Date(today);
                    startDate.setDate(startDate.getDate() + startOffset);
                    const endDate = new Date(today);
                    endDate.setDate(endDate.getDate() + endOffset);
                    
                    projectData.dates[key] = {
                        start: startDate.toISOString().split('T')[0],
                        end: endDate.toISOString().split('T')[0]
                    };
                });
            });
            
            // Initialize budgets to 0 (user will use calculator)
            projectData.budgets = {};
            template.disciplines.forEach(disc => {
                projectData.budgets[disc] = 0;
            });
            
            // Collapse template selector
            toggleTemplateSelector();
            
            // Trigger autosave
            triggerAutosave();
            
            // Update UI
            updateStatus(`TEMPLATE: ${template.name}`);
            
            // Show success message
            alert(`✅ Template "${template.name}" applied!\n\n• ${template.phases.length} phases\n• ${template.disciplines.length} disciplines\n• ${template.packages.length} packages\n\nConstruction cost pre-set to $${(template.constructionCost / 1000000).toFixed(1)}M.\nUse the Cost Estimator in Step 4 to calculate budgets.`);
        }

        // Project complexity mapping per project type
        const projectComplexityMap = {
            'Bridge': {
                'Structures': 'High', 'Design PM': 'Medium', 'Civil': 'High',
                'Drainage': 'Medium', 'Electrical': 'Low', 'Environmental': 'Medium',
                'Traffic': 'Low', 'ITS': 'Low', 'Mechanical': 'Medium',
                'Geotechnical': 'High', 'Survey': 'Medium', 'Landscape': 'Low',
                'Utilities': 'Medium', 'Lighting': 'Low', 'Pavement': 'Low',
                'Bridges': 'High', 'H&H': 'Medium', 'Communications': 'Low',
                'Architecture': 'Medium', 'Systems': 'Medium'
            },
            'Highway/Roadway': {
                'Structures': 'Medium', 'Design PM': 'High', 'Civil': 'High',
                'Drainage': 'High', 'Electrical': 'Medium', 'Environmental': 'Medium',
                'Traffic': 'High', 'ITS': 'Medium', 'Mechanical': 'Low',
                'Geotechnical': 'Medium', 'Survey': 'High', 'Landscape': 'Medium',
                'Utilities': 'High', 'Lighting': 'Medium', 'Pavement': 'High',
                'Bridges': 'Medium', 'H&H': 'High', 'Communications': 'Medium',
                'Architecture': 'Low', 'Systems': 'Medium'
            },
            'Drainage/Utilities': {
                'Structures': 'Low', 'Design PM': 'Medium', 'Civil': 'Medium',
                'Drainage': 'High', 'Electrical': 'Medium', 'Environmental': 'High',
                'Traffic': 'Low', 'ITS': 'Low', 'Mechanical': 'Low',
                'Geotechnical': 'Medium', 'Survey': 'Medium', 'Landscape': 'Low',
                'Utilities': 'High', 'Lighting': 'Low', 'Pavement': 'Medium',
                'Bridges': 'Low', 'H&H': 'High', 'Communications': 'Low',
                'Architecture': 'Low', 'Systems': 'Low'
            }
        };

        // Industry standard design fee distribution percentages
        const industryDistribution = {
            'Bridge': {
                'Structures': { Low: 18, Medium: 22, High: 28 },
                'Design PM': { Low: 8, Medium: 10, High: 13 },
                'Civil': { Low: 10, Medium: 12, High: 15 },
                'Drainage': { Low: 3, Medium: 5, High: 7 },
                'Electrical': { Low: 2, Medium: 3, High: 5 },
                'Environmental': { Low: 3, Medium: 4, High: 6 },
                'Traffic': { Low: 2, Medium: 3, High: 4 },
                'ITS': { Low: 1, Medium: 2, High: 3 },
                'Mechanical': { Low: 2, Medium: 3, High: 4 },
                'Geotechnical': { Low: 6, Medium: 8, High: 10 },
                'Survey': { Low: 3, Medium: 4, High: 5 },
                'Landscape': { Low: 1, Medium: 2, High: 3 },
                'Utilities': { Low: 2, Medium: 3, High: 4 },
                'Lighting': { Low: 1, Medium: 2, High: 3 },
                'Pavement': { Low: 2, Medium: 3, High: 4 },
                'Bridges': { Low: 18, Medium: 22, High: 28 },
                'H&H': { Low: 4, Medium: 6, High: 8 },
                'Communications': { Low: 2, Medium: 3, High: 4 },
                'Architecture': { Low: 3, Medium: 4, High: 6 },
                'Systems': { Low: 3, Medium: 5, High: 7 }
            },
            'Highway/Roadway': {
                'Structures': { Low: 10, Medium: 15, High: 20 },
                'Design PM': { Low: 10, Medium: 12, High: 15 },
                'Civil': { Low: 15, Medium: 18, High: 22 },
                'Drainage': { Low: 8, Medium: 10, High: 12 },
                'Electrical': { Low: 4, Medium: 6, High: 8 },
                'Environmental': { Low: 4, Medium: 5, High: 7 },
                'Traffic': { Low: 8, Medium: 10, High: 12 },
                'ITS': { Low: 3, Medium: 5, High: 7 },
                'Mechanical': { Low: 2, Medium: 3, High: 4 },
                'Geotechnical': { Low: 4, Medium: 6, High: 8 },
                'Survey': { Low: 5, Medium: 7, High: 9 },
                'Landscape': { Low: 3, Medium: 4, High: 6 },
                'Utilities': { Low: 6, Medium: 8, High: 10 },
                'Lighting': { Low: 3, Medium: 4, High: 6 },
                'Pavement': { Low: 10, Medium: 12, High: 15 },
                'Bridges': { Low: 8, Medium: 10, High: 12 },
                'H&H': { Low: 6, Medium: 8, High: 10 },
                'Communications': { Low: 3, Medium: 4, High: 6 },
                'Architecture': { Low: 2, Medium: 3, High: 4 },
                'Systems': { Low: 4, Medium: 5, High: 7 }
            },
            'Drainage/Utilities': {
                'Structures': { Low: 5, Medium: 8, High: 10 },
                'Design PM': { Low: 8, Medium: 10, High: 12 },
                'Civil': { Low: 12, Medium: 15, High: 18 },
                'Drainage': { Low: 18, Medium: 22, High: 26 },
                'Electrical': { Low: 4, Medium: 6, High: 8 },
                'Environmental': { Low: 8, Medium: 10, High: 14 },
                'Traffic': { Low: 2, Medium: 3, High: 4 },
                'ITS': { Low: 1, Medium: 2, High: 3 },
                'Mechanical': { Low: 2, Medium: 3, High: 4 },
                'Geotechnical': { Low: 5, Medium: 7, High: 9 },
                'Survey': { Low: 4, Medium: 6, High: 8 },
                'Landscape': { Low: 2, Medium: 3, High: 4 },
                'Utilities': { Low: 16, Medium: 20, High: 24 },
                'Lighting': { Low: 2, Medium: 3, High: 4 },
                'Pavement': { Low: 6, Medium: 8, High: 10 },
                'Bridges': { Low: 4, Medium: 6, High: 8 },
                'H&H': { Low: 8, Medium: 10, High: 12 },
                'Communications': { Low: 2, Medium: 3, High: 4 },
                'Architecture': { Low: 1, Medium: 2, High: 3 },
                'Systems': { Low: 3, Medium: 4, High: 5 }
            }
        };

        // Industry benchmark ranges for variance indicators
        const industryBenchmarks = {
            'Bridge': {
                'Structures': { min: 0.18, max: 0.30, typical: 0.24 },
                'Design PM': { min: 0.08, max: 0.15, typical: 0.11 },
                'Civil': { min: 0.10, max: 0.16, typical: 0.13 },
                'Geotechnical': { min: 0.06, max: 0.12, typical: 0.09 }
            },
            'Highway/Roadway': {
                'Structures': { min: 0.10, max: 0.22, typical: 0.16 },
                'Design PM': { min: 0.10, max: 0.16, typical: 0.13 },
                'Civil': { min: 0.15, max: 0.24, typical: 0.19 },
                'Drainage': { min: 0.08, max: 0.14, typical: 0.11 },
                'Traffic': { min: 0.08, max: 0.14, typical: 0.11 },
                'Pavement': { min: 0.10, max: 0.17, typical: 0.13 }
            },
            'Drainage/Utilities': {
                'Structures': { min: 0.05, max: 0.12, typical: 0.08 },
                'Design PM': { min: 0.08, max: 0.13, typical: 0.10 },
                'Drainage': { min: 0.18, max: 0.28, typical: 0.23 },
                'Utilities': { min: 0.16, max: 0.26, typical: 0.21 },
                'Environmental': { min: 0.08, max: 0.16, typical: 0.12 }
            }
        };

        // ============================================
        // MH BENCHMARK COST ESTIMATOR CONFIGURATION
        // ============================================
        
        function getBaseUrl() {
            var b = (typeof window !== 'undefined' && window.__BASE_URL__) ? window.__BASE_URL__ : '/';
            return String(b).replace(/\/$/, '');
        }
        /** Resolve benchmark path to full URL at fetch time so base URL is always current. */
        function getBenchmarkFileUrl(path) {
            if (typeof path !== 'string' || path.startsWith('http') || path.startsWith('//')) return path;
            var base = getBaseUrl();
            return base + (path.startsWith('/') ? path : '/' + path);
        }

        // Highway/Bridge Projects: path only (files live under public/data/benchmarking/All Other Projects/). URL resolved when fetching.
        const BENCHMARK_FILE_MAPPING_HIGHWAY_BRIDGE = {
            drainage: '/data/benchmarking/All Other Projects/benchmarking-drainage.json',
            mot: '/data/benchmarking/All Other Projects/benchmarking-mot.json',
            roadway: '/data/benchmarking/All Other Projects/benchmarking-roadway.json',
            traffic: '/data/benchmarking/All Other Projects/benchmarking-traffic.json',
            utilities: '/data/benchmarking/All Other Projects/benchmarking-utilities.json',
            retainingWalls: '/data/benchmarking/All Other Projects/benchmarking-retainingwalls.json',
            noiseWalls: '/data/benchmarking/All Other Projects/benchmarking-noisewalls.json',
            bridgesPCGirder: '/data/benchmarking/All Other Projects/benchmarking-bridges.json',
            bridgesSteel: '/data/benchmarking/All Other Projects/benchmarking-bridges.json',
            bridgesRehab: '/data/benchmarking/All Other Projects/benchmarking-bridges.json',
            miscStructures: '/data/benchmarking/All Other Projects/benchmarking-miscstructures.json',
            geotechnical: '/data/benchmarking/All Other Projects/benchmarking-geotechnical.json',
            systems: '/data/benchmarking/All Other Projects/benchmarking-systems.json',
            track: '/data/benchmarking/All Other Projects/benchmarking-track.json',
            esdc: '/data/benchmarking/All Other Projects/ESDC and TSCD/ESDC_HI.json',
            tscd: '/data/benchmarking/All Other Projects/ESDC and TSCD/TSCD_HI.json',
            digitalDelivery: '/data/benchmarking/Wall/JSON Wall/Dig_Engg.json'
        };
        const BENCHMARK_FILE_MAPPING_BORDER_WALL = {
            drainage: '/data/benchmarking/Wall/JSON Wall/Drainage.json',
            mot: '/data/benchmarking/Wall/JSON Wall/Directs.json',
            roadway: '/data/benchmarking/Wall/JSON Wall/roadway.json',
            traffic: '/data/benchmarking/Wall/JSON Wall/Directs.json',
            utilities: '/data/benchmarking/Wall/JSON Wall/Directs.json',
            retainingWalls: '/data/benchmarking/Wall/JSON Wall/Structures.json',
            bridgesPCGirder: '/data/benchmarking/Wall/JSON Wall/Structures.json',
            bridgesSteel: '/data/benchmarking/Wall/JSON Wall/Structures.json',
            bridgesRehab: '/data/benchmarking/Wall/JSON Wall/Structures.json',
            miscStructures: '/data/benchmarking/Wall/JSON Wall/Structures.json',
            geotechnical: '/data/benchmarking/Wall/JSON Wall/Geotech.json',
            systems: '/data/benchmarking/Wall/JSON Wall/Elec_Systems.json',
            track: '/data/benchmarking/Wall/JSON Wall/roadway.json',
            esdc: '/data/benchmarking/Wall/JSON Wall/Dig_Engg.json',
            tscd: '/data/benchmarking/Wall/JSON Wall/TSCd.json',
            digitalDelivery: '/data/benchmarking/Wall/JSON Wall/Dig_Engg.json'
        };

        // Active benchmark dataset selection
        let activeBenchmarkDataset = 'all-other'; // value for "Highway/Bridge Projects" in UI
        let BENCHMARK_FILE_MAPPING = { ...BENCHMARK_FILE_MAPPING_HIGHWAY_BRIDGE };

        // Cache for loaded benchmark data
        let benchmarkDataCache = {};
        let benchmarkDataLoaded = false;
        let benchmarkLoadPromise = null;
        
        // Cache for discipline resource rates (low/high)
        let disciplineResourcesCache = {};
        let disciplineResourcesLoaded = false;
        
        /**
         * Load discipline resource rates from JSON file
         */
        async function loadDisciplineResources() {
            if (disciplineResourcesLoaded) {
                return disciplineResourcesCache;
            }
            
            try {
                const response = await fetch('./data/discipline-resources.json');
                if (response.ok) {
                    const data = await response.json();
                    // Create a lookup map by discipline name (lowercase)
                    for (const disc of data.disciplines) {
                        const key = disc.discipline.toLowerCase();
                        disciplineResourcesCache[key] = {
                            lowRate: disc.lowResource.rate,
                            highRate: disc.highResource.rate,
                            lowCode: disc.lowResource.code,
                            highCode: disc.highResource.code,
                            unit: disc.unit,
                            keyQuantity: disc.keyQuantity
                        };
                    }
                    disciplineResourcesLoaded = true;
                    console.log('Discipline resources loaded:', Object.keys(disciplineResourcesCache));
                }
            } catch (error) {
                console.warn('Error loading discipline resources:', error);
            }
            
            return disciplineResourcesCache;
        }
        
        /**
         * Get resource rates for a discipline (sync, returns cached data)
         */
        function getDisciplineResources(disciplineName) {
            // Normalize the discipline name
            // Remove content in parentheses and trim
            let normalized = disciplineName.replace(/\s*\([^)]*\)\s*/g, '').trim().toLowerCase();

            // Try exact match first
            if (disciplineResourcesCache[normalized]) {
                return disciplineResourcesCache[normalized];
            }

            // Try direct mappings for common variations
            const mappings = {
                'bridges': 'bridges',
                'retaining walls': 'walls',
                'noise walls': 'walls',
                'misc structures': 'bridges',
                'geotechnical': 'geotechnical',
                'environmental': 'environmental',
                'digital delivery': null,
                'esdc': null,
                'tscd': null,
                'systems': 'track',  // Systems and Track share same resource codes
                'track': 'track'
            };

            const mappedKey = mappings[normalized];
            if (mappedKey && disciplineResourcesCache[mappedKey]) {
                return disciplineResourcesCache[mappedKey];
            }

            // If mappedKey is explicitly null, return default
            if (mappedKey === null) {
                return { lowRate: 48.00, highRate: 55.20, lowCode: 'Civ.01', highCode: 'Civ.02' };
            }

            // Try partial matching - if discipline name contains a key word
            for (const [key, value] of Object.entries(disciplineResourcesCache)) {
                if (normalized.includes(key) || key.includes(normalized)) {
                    return value;
                }
            }

            // Default fallback
            console.warn(`No resource rates found for discipline: ${disciplineName}, using default Civ.01/Civ.02`);
            return { lowRate: 48.00, highRate: 55.20, lowCode: 'Civ.01', highCode: 'Civ.02' };
        }

        /**
         * Statistical calculation functions for benchmark analysis
         */
        const BenchmarkStats = {
            /**
             * Calculate mean (average) of an array of numbers
             */
            mean: function(values) {
                if (!values || values.length === 0) return 0;
                return values.reduce((sum, val) => sum + val, 0) / values.length;
            },

            /**
             * Calculate standard deviation of an array of numbers
             */
            stdDev: function(values) {
                if (!values || values.length < 2) return 0;
                const avg = this.mean(values);
                const squaredDiffs = values.map(val => Math.pow(val - avg, 2));
                const avgSquaredDiff = this.mean(squaredDiffs);
                return Math.sqrt(avgSquaredDiff);
            },

            /**
             * Calculate the production rate with statistical bounds
             * Returns { mean, stdDev, lower, upper } where bounds are mean ± stdDev
             */
            calculateRateStats: function(projects, rateField = 'production_mhrs_per_ea') {
                if (!projects || projects.length === 0) {
                    return { mean: 0, stdDev: 0, lower: 0, upper: 0, count: 0 };
                }
                
                const rates = projects.map(p => p[rateField] || p.rate || 0).filter(r => r > 0);
                if (rates.length === 0) {
                    return { mean: 0, stdDev: 0, lower: 0, upper: 0, count: 0 };
                }
                
                const mean = this.mean(rates);
                const stdDev = this.stdDev(rates);
                
                return {
                    mean: mean,
                    stdDev: stdDev,
                    lower: Math.max(0, mean - stdDev),
                    upper: mean + stdDev,
                    count: rates.length
                };
            },

            /**
             * Estimate MH using avg ± std_dev formula
             * @param {number} quantity - The quantity to estimate for
             * @param {Object} rateStats - Stats object from calculateRateStats
             * @returns {Object} { estimate, lower, upper, range }
             */
            estimateWithBounds: function(quantity, rateStats) {
                const estimate = Math.round(quantity * rateStats.mean);
                const lower = Math.round(quantity * rateStats.lower);
                const upper = Math.round(quantity * rateStats.upper);
                
                return {
                    estimate: estimate,
                    lower: lower,
                    upper: upper,
                    range: `${lower.toLocaleString()} - ${upper.toLocaleString()}`,
                    mean: rateStats.mean,
                    stdDev: rateStats.stdDev
                };
            }
        };

        // ============================================
        // POWER REGRESSION FOR BENCHMARK CHARTS
        // ============================================
        
        /**
         * Power regression calculator for y = a * x^b curves.
         * Same basis as Excel: log-log linear regression (ln(y) = ln(a) + b*ln(x)),
         * i.e. regress ln(rate) on ln(quantity) so Rate = a * Quantity^b. Matches Excel power trendline.
         */
        const PowerRegression = {
            /**
             * Calculate power regression coefficients (y = a * x^b)
             * Uses logarithmic transformation for linear regression (Excel-compatible)
             * @param {Array} data - Array of {x, y} points (e.g. quantity, rate)
             * @returns {Object} { a, b, r2 } coefficients and R-squared
             */
            calculate: function(data) {
                const valid = data.filter(p => p.x > 0 && p.y > 0);
                if (valid.length < 2) {
                    return { a: 0, b: 0, r2: 0, valid: false };
                }
                
                // Transform to log space
                const logX = valid.map(p => Math.log(p.x));
                const logY = valid.map(p => Math.log(p.y));
                const n = valid.length;
                
                // Calculate means
                const meanLogX = logX.reduce((s, v) => s + v, 0) / n;
                const meanLogY = logY.reduce((s, v) => s + v, 0) / n;
                
                // Calculate slope (b) and intercept (log(a))
                let numerator = 0;
                let denominator = 0;
                for (let i = 0; i < n; i++) {
                    numerator += (logX[i] - meanLogX) * (logY[i] - meanLogY);
                    denominator += Math.pow(logX[i] - meanLogX, 2);
                }
                
                const b = denominator !== 0 ? numerator / denominator : 0;
                const logA = meanLogY - b * meanLogX;
                const a = Math.exp(logA);
                
                // Calculate R-squared
                let ssRes = 0;
                let ssTot = 0;
                for (let i = 0; i < n; i++) {
                    const predicted = logA + b * logX[i];
                    ssRes += Math.pow(logY[i] - predicted, 2);
                    ssTot += Math.pow(logY[i] - meanLogY, 2);
                }
                const r2 = ssTot !== 0 ? 1 - (ssRes / ssTot) : 0;
                
                return { a, b, r2, valid: true };
            },
            
            /**
             * Generate curve points for plotting
             * @param {number} a - Coefficient a
             * @param {number} b - Coefficient b  
             * @param {number} xMin - Start X value
             * @param {number} xMax - End X value
             * @param {number} numPoints - Number of points to generate
             * @returns {Array} Array of {x, y} points
             */
            generateCurve: function(a, b, xMin, xMax, numPoints = 50) {
                const points = [];
                if (xMin <= 0) xMin = 1;
                const step = (xMax - xMin) / (numPoints - 1);
                
                for (let i = 0; i < numPoints; i++) {
                    const x = xMin + i * step;
                    const y = a * Math.pow(x, b);
                    points.push({ x, y });
                }
                return points;
            },
            
            /**
             * Format regression equation as string
             * @param {number} a - Coefficient a
             * @param {number} b - Coefficient b
             * @returns {string} Formatted equation
             */
            formatEquation: function(a, b) {
                const aStr = a >= 1 ? a.toFixed(3) : a.toExponential(2);
                const bStr = b.toFixed(3);
                return `y = ${aStr}x^${bStr}`;
            }
        };

        /**
         * Build (quantity, rate) points for benchmark curve — same logic as chart
         */
        function buildRatePoints(projects, isRevenueBased) {
            if (isRevenueBased) return [];
            const toRatePoint = (p) => {
                const q = p.quantity || 0;
                const mh = p.mh || 0;
                const rate = (p.rate != null && p.rate !== '') ? Number(p.rate) : (q > 0 ? mh / q : 0);
                return { x: q, y: rate };
            };
            return projects.map(toRatePoint).filter(p => p.x > 0 && p.y >= 0);
        }

        /**
         * Interpolate rate at quantity from points (log-log linear interpolation).
         * Used when power regression is invalid; ensures rate varies with quantity.
         */
        function interpolateRateAtQuantity(points, quantity) {
            if (!points.length || quantity <= 0) return null;
            const sorted = points.filter(p => p.x > 0 && p.y > 0).sort((a, b) => a.x - b.x);
            if (sorted.length === 0) return null;
            const logQ = Math.log(quantity);
            if (quantity <= sorted[0].x) return sorted[0].y;
            if (quantity >= sorted[sorted.length - 1].x) return sorted[sorted.length - 1].y;
            let i = 0;
            while (i + 1 < sorted.length && sorted[i + 1].x < quantity) i++;
            const a = sorted[i], b = sorted[i + 1];
            const logR = Math.log(a.y) + (Math.log(b.y) - Math.log(a.y)) * (logQ - Math.log(a.x)) / (Math.log(b.x) - Math.log(a.x));
            const rate = Math.exp(logR);
            return typeof rate === 'number' && Number.isFinite(rate) && rate > 0 ? rate : null;
        }

        /**
         * Get the single "All Rate" for all projects: from JSON all_rate if present, else weighted average (total MH / total quantity).
         * Use this for Wide Open MH so the rate matches the file-derived value and does not vary with user quantity.
         * @param {string} discId - Discipline ID
         * @returns {number|null} All Rate or null if no data
         */
        function getAllProjectsAllRate(discId) {
            const benchmarks = getBenchmarkDataSync(discId);
            if (!benchmarks || !benchmarks.projects || benchmarks.projects.length === 0) return null;
            if (discId === 'esdc' || discId === 'tscd') return null;
            const meta = benchmarks.metadata || {};
            if (typeof meta.all_rate === 'number' && Number.isFinite(meta.all_rate) && meta.all_rate > 0) return meta.all_rate;
            let sumMh = 0, sumQty = 0;
            for (const p of benchmarks.projects) {
                const mh = p.mh || 0;
                const q = p.quantity || 0;
                if (q > 0 && mh >= 0) { sumMh += mh; sumQty += q; }
            }
            if (sumQty <= 0) return null;
            const weighted = sumMh / sumQty;
            return typeof weighted === 'number' && Number.isFinite(weighted) && weighted > 0 ? weighted : null;
        }

        /**
         * Get rate from All Projects regression curve at a given quantity (y = a*x^b).
         * Falls back to log-log interpolation if regression invalid so rate always varies with quantity.
         * @param {string} discId - Discipline ID
         * @param {number} quantity - Quantity (x)
         * @returns {number|null} Rate at that quantity or null if no data
         */
        function getRateFromAllProjectsCurve(discId, quantity) {
            const q = Number(quantity);
            if (!(q > 0)) return null;
            const benchmarks = getBenchmarkDataSync(discId);
            if (!benchmarks || !benchmarks.projects || benchmarks.projects.length < 2) return null;
            if (discId === 'esdc' || discId === 'tscd') return null;
            const allPoints = buildRatePoints(benchmarks.projects, false);
            if (allPoints.length < 2) return null;
            const reg = PowerRegression.calculate(allPoints);
            let rate = null;
            if (reg.valid) {
                rate = reg.a * Math.pow(q, reg.b);
                if (typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0) rate = null;
            }
            if (rate == null) rate = interpolateRateAtQuantity(allPoints, q);
            if (rate == null) return null;
            const meta = benchmarks.metadata || {};
            let factor = 1;
            if (meta.calc && typeof meta.calc.open === 'number' && Number.isFinite(meta.calc.open) && meta.calc.open > 0) factor = meta.calc.open;
            else if (typeof meta.all_curve_factor === 'number' && Number.isFinite(meta.all_curve_factor) && meta.all_curve_factor > 0) factor = meta.all_curve_factor;
            return rate * factor;
        }

        /** Assumed hourly rate ($/hr) for ESDC and TSCD used for MH and revenue calcs */
        const ESDC_TSCD_HOURLY_RATE = 64.5;

        /** Default % of Assumed Construction Cost for subs/ODCs. Geotech Drilling = 0.50%; rest = 0.25%. */
        const DEFAULT_SURVEY_SUBS_PCT = 0.25;
        const DEFAULT_SUBSURFACE_UTILITY_SUBS_PCT = 0.25;
        const DEFAULT_GEOTECH_SUBS_PCT = 0.5;
        const DEFAULT_ODCS_PCT = 0.25;

        /**
         * Get production % from Selected Projects power curve for ESDC/TSCD (Excel trendline method).
         * Curve: x = Revenue (K$), y = Production (%). Coefficients a, b are calculated from selected projects.
         * Solves P = a * (Revenue_K)^b with Revenue_K = AssumedCost_K * P / 100 => P = [a * (AssumedCost_K/100)^b]^(1/(1-b)).
         * @param {string} discId - 'esdc' or 'tscd'
         * @param {number} assumedConstructionCostK - Assumed construction cost in thousands (K$)
         * @returns {number|null} Production % (e.g. 1.19 for 1.19%) or null
         */
        function getProductionPctFromSelectedCurve(discId, assumedConstructionCostK) {
            if (discId !== 'esdc' && discId !== 'tscd') return null;
            const costK = Number(assumedConstructionCostK);
            if (!(costK > 0)) return null;
            const benchmarks = getBenchmarkDataSync(discId);
            if (!benchmarks || !benchmarks.projects) return null;
            const selectedProjects = benchmarks.projects.filter(p => p.applicable);
            if (selectedProjects.length < 2) return null;
            // Excel trendline: x = Revenue (K$), y = Production (%). Build points from selected projects.
            const points = selectedProjects
                .map(p => {
                    const x = p.esdc_cost ?? p.cost ?? 0;   // Revenue in K$
                    const y = p.production_pct ?? p.rate ?? 0; // Production %
                    return { x, y };
                })
                .filter(p => p.x > 0 && p.y > 0);
            if (points.length < 2) return null;
            const reg = PowerRegression.calculate(points);
            let pct = null;
            if (reg.valid && typeof reg.a === 'number' && Number.isFinite(reg.a) && reg.a > 0 &&
                typeof reg.b === 'number' && Number.isFinite(reg.b) && reg.b < 1) {
                // P = a * (Revenue_K)^b, Revenue_K = costK * P / 100 => P = a * (costK*P/100)^b
                // => P^(1-b) = a * (costK/100)^b => P = [a * (costK/100)^b]^(1/(1-b))
                const exponent = 1 / (1 - reg.b);
                const base = reg.a * Math.pow(costK / 100, reg.b);
                if (base > 0 && Number.isFinite(exponent)) {
                    pct = Math.pow(base, exponent);
                    if (typeof pct !== 'number' || !Number.isFinite(pct) || pct <= 0) pct = null;
                }
            }
            if (pct == null) {
                // Fallback: average production % of selected projects
                const sum = selectedProjects.reduce((s, p) => s + (p.production_pct ?? p.rate ?? 0), 0);
                pct = selectedProjects.length > 0 ? sum / selectedProjects.length : null;
            }
            return pct;
        }

        /**
         * Get rate from Selected Projects regression curve at a given quantity (y = a*x^b).
         * Falls back to log-log interpolation if regression invalid.
         * @param {string} discId - Discipline ID
         * @param {number} quantity - Quantity (x)
         * @returns {number|null} Rate at that quantity or null if no data
         */
        function getRateFromSelectedProjectsCurve(discId, quantity) {
            const q = Number(quantity);
            if (!(q > 0)) return null;
            const benchmarks = getBenchmarkDataSync(discId);
            if (!benchmarks || !benchmarks.projects) return null;
            if (discId === 'esdc' || discId === 'tscd') return null;
            const selectedProjects = benchmarks.projects.filter(p => p.applicable);
            if (selectedProjects.length < 2) return null;
            const selectedPoints = buildRatePoints(selectedProjects, false);
            if (selectedPoints.length < 2) return null;
            const reg = PowerRegression.calculate(selectedPoints);
            let rate = null;
            if (reg.valid) {
                rate = reg.a * Math.pow(q, reg.b);
                if (typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0) rate = null;
            }
            if (rate == null) rate = interpolateRateAtQuantity(selectedPoints, q);
            if (rate == null) return null;
            const meta = benchmarks.metadata || {};
            let factor = 1;
            if (meta.calc && meta.calc.custom_from_selected === true && selectedProjects.length >= 2) {
                const rateStats = BenchmarkStats.calculateRateStats(selectedProjects);
                if (rateStats.mean > 0 && rateStats.count > 0) {
                    const k = typeof meta.calc.custom_std_dev_coefficient === 'number' && Number.isFinite(meta.calc.custom_std_dev_coefficient) ? meta.calc.custom_std_dev_coefficient : 0;
                    factor = 1 + k * (rateStats.stdDev / rateStats.mean);
                    if (factor <= 0 || !Number.isFinite(factor)) factor = 1;
                }
            } else if (meta.calc && typeof meta.calc.custom === 'number' && Number.isFinite(meta.calc.custom) && meta.calc.custom > 0) factor = meta.calc.custom;
            else if (typeof meta.selected_curve_factor === 'number' && Number.isFinite(meta.selected_curve_factor) && meta.selected_curve_factor > 0) factor = meta.selected_curve_factor;
            return rate * factor;
        }
        
        // Benchmark chart instance (for the modal)
        let benchmarkChart = null;
        let currentBenchmarkDiscipline = null;
        
        /**
         * Create or update the benchmark regression chart
         * @param {string} discId - Discipline ID to chart
         */
        function updateBenchmarkChart(discId) {
            const canvas = document.getElementById('benchmark-chart-canvas');
            if (!canvas) return;
            
            const benchmarks = getBenchmarkDataSync(discId);
            if (!benchmarks || !benchmarks.projects) return;

            const config = DISCIPLINE_CONFIG[discId] || {
                unit: benchmarks.eqty_metric?.uom || 'EA'
            };
            const allProjects = benchmarks.projects;
            const selectedProjects = allProjects.filter(p => p.applicable);
            
            // Check if this is a revenue-based discipline (ESDC/TSCD)
            const isRevenueBased = (discId === 'esdc' || discId === 'tscd');
            
            // Update chart title dynamically
            const chartTitle = document.getElementById('benchmark-chart-title');
            if (chartTitle) {
                chartTitle.textContent = isRevenueBased ? '📈 Production vs Revenue' : '📈 Rate vs Quantity';
            }
            
            // Convert to chart data points
            let allPoints, selectedPoints;
            
            if (isRevenueBased) {
                // ESDC/TSCD: X = Revenue (esdc_cost), Y = Production % (production_pct)
                allPoints = allProjects.map(p => ({ 
                    x: p.esdc_cost || p.cost || 0, // Revenue in K$
                    y: p.production_pct || p.rate || 0, // Production %
                    name: p.name,
                    projectCost: p.anticipated_cost || p.projectCost || 0
                })).filter(p => p.x > 0 && p.y > 0);
                
                selectedPoints = selectedProjects.map(p => ({ 
                    x: p.esdc_cost || p.cost || 0, // Revenue in K$
                    y: p.production_pct || p.rate || 0, // Production %
                    name: p.name,
                    projectCost: p.anticipated_cost || p.projectCost || 0
                })).filter(p => p.x > 0 && p.y > 0);
            } else {
                // Standard: plot Quantity (x) vs Rate (y) — same Rate values shown in the project list
                const toRatePoint = (p) => {
                    const q = p.quantity || 0;
                    const mh = p.mh || 0;
                    const rate = (p.rate != null && p.rate !== '') ? Number(p.rate) : (q > 0 ? mh / q : 0);
                    return { x: q, y: rate, name: p.name, mh, quantity: q };
                };
                allPoints = allProjects.map(toRatePoint).filter(p => p.x > 0 && p.y >= 0);
                selectedPoints = selectedProjects.map(toRatePoint).filter(p => p.x > 0 && p.y >= 0);
            }
            
            // Calculate regressions (chart always uses data-derived curve; optional factor applied only to rate used for All/Selected Rate)
            // For ESDC/TSCD: Use pre-calculated curve from JSON if available
            let allRegression, selectedRegression;
            
            if (isRevenueBased && benchmarks.curve && benchmarks.curve.a && benchmarks.curve.b) {
                // Use curve from JSON file
                allRegression = {
                    valid: true,
                    a: benchmarks.curve.a,
                    b: benchmarks.curve.b,
                    r2: benchmarks.curve.r2 || 0
                };
                // For selected, recalculate from selected points
                selectedRegression = PowerRegression.calculate(selectedPoints);
            } else {
                allRegression = PowerRegression.calculate(allPoints);
                selectedRegression = PowerRegression.calculate(selectedPoints);
            }
            
            // Smart X-axis scaling: focus on where data is dense (for ESDC/TSCD use selected only)
            const pointsForScale = isRevenueBased ? selectedPoints : allPoints;
            const quantities = pointsForScale.map(p => p.x).sort((a, b) => a - b);
            const p90Index = Math.floor(quantities.length * 0.9);
            const p90Value = quantities[p90Index] || quantities[quantities.length - 1] || 100000;
            const xMax = p90Value * 1.2;
            const xMin = Math.min(...quantities) * 0.5 || 1;
            
            // Generate curve points from regression only
            const allCurvePoints = allRegression.valid
                ? PowerRegression.generateCurve(allRegression.a, allRegression.b, xMin, xMax, 60)
                : [];
            const selectedCurvePoints = selectedRegression.valid
                ? PowerRegression.generateCurve(selectedRegression.a, selectedRegression.b, xMin, xMax, 60)
                : [];
            
            // Update equations display (chart shows data-derived curve; factor from Excel is applied only to displayed All/Selected Rate)
            const allEqEl = document.getElementById('benchmark-eq-all');
            const selEqEl = document.getElementById('benchmark-eq-selected');
            const allR2El = document.getElementById('benchmark-r2-all');
            const selR2El = document.getElementById('benchmark-r2-selected');
            
            // ESDC/TSCD: only show selected data (no "All Projects"); use same dot colors as other disciplines (blue)
            const showAllData = !isRevenueBased;
            const legendAllEl = document.getElementById('benchmark-legend-all');
            const equationAllWrap = document.getElementById('benchmark-equation-all-wrap');
            if (legendAllEl) legendAllEl.style.display = showAllData ? '' : 'none';
            if (equationAllWrap) equationAllWrap.style.display = showAllData ? '' : 'none';
            const legendSelectedDot = document.querySelector('.benchmark-chart-legend .legend-dot.selected-projects');
            if (legendSelectedDot) {
                legendSelectedDot.style.background = isRevenueBased ? '#4a90d9' : '#e07c3a';
            }
            const eqSelectedEl = document.getElementById('benchmark-eq-selected');
            if (eqSelectedEl) eqSelectedEl.style.color = isRevenueBased ? '#4a90d9' : '#e07c3a';

            if (allEqEl) {
                allEqEl.textContent = allRegression.valid
                    ? PowerRegression.formatEquation(allRegression.a, allRegression.b)
                    : 'Insufficient data';
            }
            if (selEqEl) {
                selEqEl.textContent = selectedRegression.valid
                    ? PowerRegression.formatEquation(selectedRegression.a, selectedRegression.b)
                    : 'Insufficient data';
            }
            if (allR2El) {
                allR2El.textContent = allRegression.valid ? `R² = ${allRegression.r2.toFixed(4)}` : '';
            }
            if (selR2El) {
                selR2El.textContent = selectedRegression.valid ? `R² = ${selectedRegression.r2.toFixed(4)}` : '';
            }
            
            // Chart datasets (for ESDC/TSCD only Selected; for others All + Selected)
            const datasets = [];
            if (showAllData) {
                datasets.push(
                    { label: 'All Projects', data: allPoints, backgroundColor: 'rgba(74, 144, 217, 0.5)', borderColor: 'rgba(74, 144, 217, 0.9)', borderWidth: 2, pointRadius: 6, pointHoverRadius: 8, showLine: false, order: 2 },
                    { label: 'All Projects Trend', data: allCurvePoints, borderColor: 'rgba(74, 144, 217, 0.5)', borderWidth: 2, borderDash: [5, 5], pointRadius: 0, showLine: true, fill: false, order: 4 }
                );
            }
            // Same colors as other disciplines: blue #4a90d9 (74,144,217) for selected when ESDC/TSCD; orange for others
            const selectedColor = isRevenueBased ? { bg: 'rgba(74, 144, 217, 0.5)', border: 'rgba(74, 144, 217, 0.9)', line: 'rgba(74, 144, 217, 0.7)' } : { bg: 'rgba(224, 124, 58, 0.5)', border: 'rgba(224, 124, 58, 0.9)', line: 'rgba(224, 124, 58, 0.7)' };
            datasets.push(
                { label: 'Selected Projects', data: selectedPoints, backgroundColor: selectedColor.bg, borderColor: selectedColor.border, borderWidth: 2, pointRadius: 7, pointHoverRadius: 9, showLine: false, order: 1 },
                { label: 'Selected Projects Trend', data: selectedCurvePoints, borderColor: selectedColor.line, borderWidth: 2, borderDash: [3, 3], pointRadius: 0, showLine: true, fill: false, order: 3 }
            );
            
            // Y-axis max: use the highest curve value with buffer (for ESDC/TSCD use selected only)
            const yValues = showAllData
                ? [...allPoints.map(p => p.y), ...allCurvePoints.map(p => p.y)]
                : [...selectedPoints.map(p => p.y), ...selectedCurvePoints.map(p => p.y)];
            const yMax = Math.max(...yValues) * 1.1 || (isRevenueBased ? 10000 : 100);
            
            const chartConfig = {
                type: 'scatter',
                data: { datasets },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: {
                        mode: 'nearest',
                        intersect: true
                    },
                    plugins: {
                        legend: {
                            display: false
                        },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    const point = context.raw;
                                    if (isRevenueBased) {
                                        // ESDC/TSCD: Show production % and revenue
                                        if (point.name) {
                                            return `${point.name}: ${point.y.toFixed(2)}% Production @ $${point.x.toLocaleString()}K Revenue (Project: $${point.projectCost?.toLocaleString() || 0}K)`;
                                        }
                                        return `${point.y.toFixed(2)}% Production`;
                                    } else {
                                        const rate = point.y;
                                        const mh = point.mh != null ? point.mh : (point.x * rate);
                                        const q = point.x;
                                        const unit = config?.unit || 'units';
                                        if (point.name) {
                                            return `${point.name}: ${rate.toFixed(2)} MH/${unit} (${Number(mh).toLocaleString()} MH @ ${Number(q).toLocaleString()} ${unit})`;
                                        }
                                        return `${rate.toFixed(2)} MH/${unit}`;
                                    }
                                }
                            }
                        }
                    },
                    scales: {
                        x: {
                            type: 'linear',
                            position: 'bottom',
                            min: 0,
                            max: xMax,
                            title: {
                                display: true,
                                text: isRevenueBased ? 'Revenue (K$)' : `Quantity (${config?.unit || 'units'})`,
                                color: '#888'
                            },
                            ticks: {
                                color: '#888',
                                callback: function(value) {
                                    return isRevenueBased ? '$' + value.toLocaleString() + 'K' : value.toLocaleString();
                                }
                            },
                            grid: {
                                color: 'rgba(255, 255, 255, 0.1)'
                            }
                        },
                        y: {
                            type: 'linear',
                            min: 0,
                            max: yMax,
                            title: {
                                display: true,
                                text: isRevenueBased ? 'Production (%)' : `Rate (MH/${config?.unit || 'unit'})`,
                                color: '#888'
                            },
                            ticks: {
                                color: '#888',
                                callback: function(value) {
                                    return isRevenueBased ? value.toFixed(2) + '%' : Number(value).toFixed(3);
                                }
                            },
                            grid: {
                                color: 'rgba(255, 255, 255, 0.1)'
                            }
                        }
                    }
                }
            };
            
            // Destroy existing chart and create new one
            if (benchmarkChart) {
                benchmarkChart.destroy();
            }
            
            const ctx = canvas.getContext('2d');
            benchmarkChart = new Chart(ctx, chartConfig);
        }

        /**
         * Build tooltip content for "All Projects" production rate
         * @param {string} discId - Discipline ID
         * @param {number} rate - Production rate (MH per unit)
         * @param {number} projectCount - Number of projects used
         * @param {string} unit - Unit of measure
         * @returns {string} Tooltip text
         */
        function buildAllProjectsRateTooltip(discId, rate, projectCount, unit) {
            if (!rate || rate === 0) {
                return 'No benchmark data available';
            }
            const config = DISCIPLINE_CONFIG[discId];
            return `ALL PROJECTS RATE: ${rate.toFixed(3)} MH/${unit}

CALCULATION: Average of production rates from ALL ${projectCount} benchmark projects

FORMULA: Sum of all project rates / ${projectCount} projects

USE CASE: Baseline reference rate. Use this when you want a broad industry average without filtering for project similarity.`;
        }

        /**
         * Build tooltip content for "Selected Projects" production rate
         * @param {string} discId - Discipline ID
         * @param {number} rate - Production rate (MH per unit)
         * @param {number} projectCount - Number of selected projects
         * @param {string} unit - Unit of measure
         * @param {Object} rateStats - Optional statistics object
         * @returns {string} Tooltip text
         */
        function buildSelectedRateTooltip(discId, rate, projectCount, unit, rateStats = null) {
            if (!rate || rate === 0) {
                return 'No benchmark data selected';
            }
            let tooltip = `SELECTED PROJECTS RATE: ${rate.toFixed(3)} MH/${unit}

CALCULATION: Weighted average of ${projectCount || 'selected'} benchmark projects

FORMULA: Total MH / Total Quantity from selected projects`;

            if (rateStats && rateStats.stdDev > 0) {
                tooltip += `

STATISTICS:
  Mean: ${rateStats.mean.toFixed(3)} MH/${unit}
  Std Dev: ${rateStats.stdDev.toFixed(3)}
  Range: ${rateStats.lower.toFixed(3)} - ${rateStats.upper.toFixed(3)}`;
            }

            tooltip += `

USE CASE: More accurate estimate based on similar projects. Click "Select Benchmarks" to choose which projects to include.`;
            return tooltip;
        }

        /**
         * Build tooltip for quantity input showing RFP reasoning
         * @param {string} discId - Discipline ID
         * @param {number} quantity - The quantity value
         * @param {string} reasoning - AI reasoning text
         * @returns {string} Tooltip text
         */
        function buildQuantityReasoningTooltip(discId, quantity, reasoning) {
            if (!reasoning) {
                return 'Manual entry - no RFP reasoning available';
            }
            const config = DISCIPLINE_CONFIG[discId];
            return `RFP EXTRACTED QUANTITY: ${quantity.toLocaleString()} ${config?.unit || ''}

AI REASONING:
${reasoning}`;
        }

        /**
         * Parse Wall project JSON format (tabular array) into expected structure
         * Wall files can contain multiple discipline sections (e.g., Roadway has both Alignment Length and Barrier Length)
         * @param {Array} tabularData - Array of row objects from Wall JSON
         * @returns {Array} Array of discipline objects, one per metric section
         */
        function parseWallFormat(tabularData) {
            if (!Array.isArray(tabularData) || tabularData.length < 3) {
                return [];
            }

            const disciplines = [];
            const firstRow = tabularData[0];

            // Find all discipline columns (keys that aren't col_N)
            const disciplineKeys = Object.keys(firstRow).filter(k => k !== 'col_0' && !k.match(/^col_\d+$/));

            for (const disciplineKey of disciplineKeys) {
                // Extract discipline name (remove .1, .2 suffixes)
                const baseDisciplineName = disciplineKey.replace(/\.\d+$/, '');

                // Extract metric info from first row (format: "eQTY: Metric Name (UNIT)")
                const metricText = firstRow[disciplineKey] || '';
                const metricMatch = metricText.match(/eQTY:\s*(.+?)(?:\s*\((\w+)\))?$/);

                if (!metricMatch) continue; // Skip if not a metric header

                const metricName = metricMatch[1].trim();
                const metricUnit = metricMatch[2] || 'EA';

                // Determine column indices for this metric section
                const allKeys = Object.keys(firstRow);
                const startIdx = allKeys.indexOf(disciplineKey);
                const nextDisciplineIdx = allKeys.findIndex((k, i) => i > startIdx && disciplineKeys.includes(k));
                const endIdx = nextDisciplineIdx === -1 ? allKeys.length : nextDisciplineIdx;
                const colKeys = allKeys.slice(startIdx, endIdx);

                // Parse project rows
                const projects = [];
                for (let i = 2; i < tabularData.length; i++) {
                    const row = tabularData[i];
                    const projectName = row[disciplineKey];

                    // Stop at summary rows
                    if (!projectName || projectName.includes('Production') || projectName.includes('Input / Output') ||
                        projectName.includes('Average') || projectName.includes('Standard Dev.') ||
                        projectName.includes('Key Quantity') || projectName.includes('Total MHR')) {
                        break;
                    }

                    // Parse numeric values based on column positions
                    const fctMhrs = parseFloat(row[colKeys[1]]) || 0;
                    const eqty = parseFloat(row[colKeys[2]]) || 0;
                    const unit = row[colKeys[3]] || metricUnit;
                    const production = parseFloat(row[colKeys[4]]) || 0;
                    const applicable = row[colKeys[5]] === 'Yes';

                    // Create project object
                    if (projectName && fctMhrs > 0 && eqty > 0) {
                        projects.push({
                            project: projectName,
                            fct_mhrs: fctMhrs,
                            eqty: eqty,
                            uom: unit,
                            production_mhrs_per_ea: production,
                            applicable_job: applicable
                        });
                    }
                }

                if (projects.length > 0) {
                    // Create a unique ID for this discipline-metric combo
                    const disciplineId = baseDisciplineName
                        .toLowerCase()
                        .replace(/[\/\(\)\s]+/g, '_')
                        .replace(/_+/g, '_')
                        .replace(/^_|_$/g, '') + '_' + metricName.toLowerCase().replace(/\s+/g, '_');

                    disciplines.push({
                        id: disciplineId,
                        discipline: baseDisciplineName,
                        displayName: `${baseDisciplineName} - ${metricName}`,
                        eqty_metric: {
                            name: metricName,
                            uom: metricUnit
                        },
                        projects: projects,
                        account_code: '—' // Wall files don't have account codes
                    });
                }
            }

            return disciplines;
        }

        /**
         * Load benchmark data from JSON files
         * @returns {Promise<Object>} The loaded benchmark data
         */
        async function loadBenchmarkData() {
            if (benchmarkDataLoaded) {
                return benchmarkDataCache;
            }

            if (benchmarkLoadPromise) {
                return benchmarkLoadPromise;
            }

            benchmarkLoadPromise = (async () => {
                console.log('Loading benchmark data from JSON files...');
                const loadedData = {};

                // Load all unique JSON files (resolve URL at fetch time so base path is correct)
                const uniqueFiles = [...new Set(Object.values(BENCHMARK_FILE_MAPPING))];
                const fileDataMap = {};

                for (const filePath of uniqueFiles) {
                    try {
                        const url = getBenchmarkFileUrl(filePath);
                        const response = await fetch(url);
                        if (response.ok) {
                            const rawData = await response.json();

                            // Check if this is Wall format (array) or standard format (object)
                            if (Array.isArray(rawData)) {
                                fileDataMap[filePath] = parseWallFormat(rawData);
                            } else {
                                fileDataMap[filePath] = [rawData];
                            }
                        } else {
                            console.warn(`Failed to load benchmark file: ${url} (status ${response.status})`);
                        }
                    } catch (error) {
                        console.warn(`Error loading benchmark file ${filePath}:`, error);
                    }
                }

                // Load account codes from Summary file for Wall projects
                const accountCodeMap = {};
                if (activeBenchmarkDataset === 'border-wall') {
                    try {
                        const summaryPath = getBaseUrl() + '/data/benchmarking/Wall/JSON Wall/Summary_-MH.json';
                        console.log('🔷 Loading Summary file from:', summaryPath);
                        const summaryResponse = await fetch(summaryPath);
                        console.log('🔷 Summary response ok:', summaryResponse.ok, 'status:', summaryResponse.status);

                        if (summaryResponse.ok) {
                            const summaryData = await summaryResponse.json();
                            console.log('🔷 Summary data loaded:', summaryData ? 'YES' : 'NO', 'rows:', summaryData?.rows?.length);

                            if (summaryData && summaryData.rows && Array.isArray(summaryData.rows)) {
                                summaryData.rows.forEach((row, idx) => {
                                    try {
                                        if (!row) return;
                                        const discName = row.Discipline?.value;
                                        const accountCode = row['Account Codes']?.value;
                                        if (discName && accountCode) {
                                            accountCodeMap[discName.toLowerCase()] = accountCode;
                                        }
                                    } catch (rowError) {
                                        console.warn(`Error processing Summary row ${idx}:`, rowError);
                                    }
                                });
                            }
                            console.log('🔷 Loaded account codes from Summary:', accountCodeMap);
                        } else {
                            console.warn('Failed to load Summary file, status:', summaryResponse.status);
                        }
                    } catch (error) {
                        console.error('❌ Failed to load Summary_-MH.json for account codes:', error);
                    }
                }

                // Transform the loaded data to match the expected format
                // For Wall format: each file can contain multiple disciplines
                // For standard format: each file maps to one discipline ID
                if (activeBenchmarkDataset === 'border-wall') {
                    console.log('🔷 Loading Wall Projects data...');
                    console.log('🔷 Unique files:', uniqueFiles);
                    console.log('🔷 Account code map:', accountCodeMap);

                    // Wall Projects: load all disciplines from all files
                    for (const filePath of uniqueFiles) {
                        const disciplinesFromFile = fileDataMap[filePath];
                        console.log(`🔷 Processing ${filePath}:`, disciplinesFromFile ? `${disciplinesFromFile.length} disciplines` : 'NULL');
                        if (!Array.isArray(disciplinesFromFile)) {
                            console.warn(`⚠️  Skipping ${filePath} - not an array`);
                            continue;
                        }

                        for (const discData of disciplinesFromFile) {
                            // Skip Design Directs disciplines for Wall Projects
                            if (discData.discipline && discData.discipline.toLowerCase().includes('design directs')) {
                                console.log(`🔷 Skipping Design Directs discipline: ${discData.discipline}`);
                                continue;
                            }

                            const projects = discData.projects || [];
                            const disciplineId = discData.id;

                            // Transform projects to the expected format
                            const transformedProjects = projects.map((p, index) => {
                                return {
                                    id: p.project?.toLowerCase().replace(/\s+/g, '_').substring(0, 20) || `proj_${index}`,
                                    name: p.project || 'Unknown Project',
                                    mh: p.fct_mhrs || 0,
                                    quantity: p.eqty || 0,
                                    unit: p.uom || discData.eqty_metric?.uom || 'EA',
                                    rate: p.production_mhrs_per_ea || 0,
                                    type: 'wall',
                                    complexity: 'medium',
                                    applicable: p.applicable_job !== undefined ? p.applicable_job : true
                                };
                            }).filter(p => p !== null);

                            // Calculate statistical rates
                            const rateStats = BenchmarkStats.calculateRateStats(transformedProjects);

                            // Look up account code from Summary file
                            let accountCode = '—';
                            try {
                                const baseDisciplineLower = (discData.discipline || '').toLowerCase();
                                accountCode = accountCodeMap[baseDisciplineLower] || discData.account_code || '—';

                                // Try alternative matching for partial names
                                if (accountCode === '—' && accountCodeMap) {
                                    for (const [key, value] of Object.entries(accountCodeMap)) {
                                        if (baseDisciplineLower && (baseDisciplineLower.includes(key) || key.includes(baseDisciplineLower))) {
                                            accountCode = value;
                                            break;
                                        }
                                    }
                                }

                                // Split account codes for disciplines with multiple codes (Alignment vs Barrier)
                                // Format: "code1, code2" where code1 = Alignment, code2 = Barrier
                                if (accountCode && typeof accountCode === 'string' && accountCode.includes(',')) {
                                    const codes = accountCode.split(',').map(c => c.trim());
                                    const metricName = discData.eqty_metric?.name || '';
                                    if (metricName.toLowerCase().includes('alignment')) {
                                        accountCode = codes[0]; // First code for Alignment
                                    } else if (metricName.toLowerCase().includes('barrier')) {
                                        accountCode = codes[1] || codes[0]; // Second code for Barrier, fallback to first
                                    }
                                }
                            } catch (accountCodeError) {
                                console.warn('Error processing account code for discipline:', discData.discipline, accountCodeError);
                                accountCode = '—';
                            }

                            loadedData[disciplineId] = {
                                projects: transformedProjects,
                                defaultRate: rateStats.mean,
                                customRate: rateStats.mean,
                                rateStats: rateStats,
                                discipline: discData.discipline,
                                displayName: discData.displayName,
                                account_code: accountCode,
                                eqty_metric: discData.eqty_metric
                            };
                        }
                    }
                } else {
                    // Highway/Bridge Projects: standard format with predefined discipline mapping
                    for (const [disciplineId, filePath] of Object.entries(BENCHMARK_FILE_MAPPING)) {
                        const fileDataArray = fileDataMap[filePath];
                        if (!Array.isArray(fileDataArray) || fileDataArray.length === 0) continue;

                        const fileData = fileDataArray[0]; // Standard format has one discipline per file
                        
                        // Handle new ESDC/TSCD format with 'rows' array and field names with spaces
                        let projects = fileData.projects || fileData.structures || fileData.project_structures || [];
                        
                        // Check for new ESDC/TSCD format (has 'rows' array and 'sheet' field)
                        const isNewEsdcTscdFormat = fileData.rows && fileData.sheet && (disciplineId === 'esdc' || disciplineId === 'tscd');
                        if (isNewEsdcTscdFormat) {
                            projects = fileData.rows;
                        }

                        // Transform projects to the expected format
                        const transformedProjects = projects.map((p, index) => {
                            // Determine the rate field based on discipline type
                            let rate = p.production_mhrs_per_ea || p.production_pct || p.rate || 0;
                            let mh = p.fct_mhrs || p.mh || 0;
                            let quantity = p.eqty || p.quantity || 0;

                            // For ESDC/TSCD, handle both old and new formats
                            if (disciplineId === 'esdc' || disciplineId === 'tscd') {
                                if (isNewEsdcTscdFormat) {
                                    // New format: field names have spaces, Production is decimal (e.g., 0.0119 = 1.19%)
                                    // Convert decimal to percentage (multiply by 100)
                                    rate = (p['Production'] || 0) * 100; // 0.0119 → 1.19%
                                    mh = p['ESDC Cost'] || 0; // Revenue in K$
                                    quantity = p['eQTY'] || 0; // Project cost in K$
                                } else {
                                    // Old format: production_pct is already percentage (1.19 for 1.19%)
                                    rate = p.production_pct || 0;
                                    mh = p.esdc_cost || p.cost || 0; // Revenue in K$
                                    quantity = p.eqty || p.anticipated_cost || p.projectCost || 0; // Project cost in K$
                                }
                            }

                            // For bridges, filter by type
                            if (disciplineId === 'bridgesPCGirder' && p.notes && p.notes.includes('Steel')) {
                                return null; // Skip steel bridges for PC Girder
                            }
                            if (disciplineId === 'bridgesSteel' && p.notes && !p.notes.includes('Steel')) {
                                return null; // Skip non-steel bridges
                            }
                            if (disciplineId === 'bridgesRehab' && p.notes && !p.notes.toLowerCase().includes('rehab')) {
                                return null; // Skip non-rehab bridges
                            }

                            // Handle new ESDC/TSCD format field names
                            let projectName, projectUnit, projectMarket, isApplicable, projectCity, projectState, projectCountry;
                            
                            if (isNewEsdcTscdFormat) {
                                // New format: field names with spaces; skip rows with no project name (keep full list for TSCD/ESDC)
                                const rawProject = p['Project'];
                                if (rawProject == null || String(rawProject).trim() === '') return null;
                                projectName = String(rawProject).trim();
                                projectUnit = p['Unit'] || 'K$';
                                projectMarket = p['Market'] || '';
                                // ESDC/TSCD: only "Yes" in applicable column = selected; default unselected so list shows whole list with only Yes checked
                                isApplicable = false;
                                const applicableVal = p['Applicable Job'] ?? p['Applicable?'] ?? p['Applicable'];
                                if (applicableVal === 'Yes' || applicableVal === true || (typeof applicableVal === 'string' && String(applicableVal).trim().toLowerCase() === 'yes')) {
                                    isApplicable = true;
                                }
                                // City, State is combined in new format
                                const cityState = p['City, State'] || '';
                                const cityStateParts = cityState.split(',').map(s => s.trim());
                                projectCity = cityStateParts[0] || '';
                                projectState = cityStateParts[1] || '';
                                projectCountry = p['Country'] || 'USA';
                            } else {
                                // Old format
                                projectName = p.project || p.structure_name || 'Unknown Project';
                                projectUnit = p.uom || fileData.eqty_metric?.uom || '';
                                projectMarket = p.market || '';
                                // For ESDC/TSCD only "Yes" (or true) in applicable column = selected; rest = unselected
                                if (disciplineId === 'esdc' || disciplineId === 'tscd') {
                                    const v = p.applicable_job;
                                    isApplicable = v === true || (typeof v === 'string' && String(v).trim().toLowerCase() === 'yes');
                                } else {
                                    isApplicable = p.applicable_job !== undefined ? p.applicable_job : true;
                                }
                                projectCity = p.city || '';
                                projectState = p.state || '';
                                projectCountry = p.country || 'USA';
                            }
                            
                            const transformedProject = {
                                id: projectName.toLowerCase().replace(/\s+/g, '_').substring(0, 20) || `proj_${index}`,
                                name: projectName,
                                mh: mh,
                                quantity: quantity,
                                unit: projectUnit,
                                rate: rate,
                                type: projectMarket.includes('Transit') ? 'transit' : 'highway',
                                complexity: 'medium',
                                applicable: isApplicable,
                                // Additional metadata
                                city: projectCity,
                                state: projectState,
                                country: projectCountry,
                                notes: p.notes
                            };
                            
                            // For ESDC/TSCD, add additional revenue-specific fields
                            if (disciplineId === 'esdc' || disciplineId === 'tscd') {
                                if (isNewEsdcTscdFormat) {
                                    // New format with field names with spaces
                                    const esdcCostVal = p['ESDC Cost'] || 0;
                                    const eqtyVal = p['eQTY'] || 0;
                                    const productionPct = (p['Production'] || 0) * 100; // Convert decimal to percentage
                                    transformedProject.esdc_cost = esdcCostVal; // Revenue in K$
                                    transformedProject.anticipated_cost = eqtyVal; // Project cost in K$
                                    transformedProject.production_pct = productionPct; // % of project cost
                                    transformedProject.cost = esdcCostVal; // Alias for revenue
                                    transformedProject.projectCost = eqtyVal; // Alias for project cost
                                } else {
                                    // Old format
                                    transformedProject.esdc_cost = p.esdc_cost || 0; // Revenue in K$
                                    transformedProject.anticipated_cost = p.eqty || 0; // Project cost in K$
                                    transformedProject.production_pct = p.production_pct || 0; // % of project cost
                                    transformedProject.cost = p.esdc_cost || 0; // Alias for revenue
                                    transformedProject.projectCost = p.eqty || 0; // Alias for project cost
                                }
                            }
                            
                            return transformedProject;
                        }).filter(p => p !== null);

                        // ESDC: exactly 44 projects from Excel A5:A48 (same list as when benchmark icon is used).
                        if (disciplineId === 'esdc' && isNewEsdcTscdFormat) {
                            transformedProjects = transformedProjects.slice(0, 44);
                        }
                        // TSCD: 109 projects from Excel A5:A113. Use first 109 projects only when benchmark icon is used.
                        if (disciplineId === 'tscd' && isNewEsdcTscdFormat) {
                            transformedProjects = transformedProjects.slice(0, 109);
                        }

                        // Calculate statistical rates
                        const rateStats = BenchmarkStats.calculateRateStats(transformedProjects);

                        // Build metadata - handle new ESDC/TSCD format
                        let metadata;
                        if (isNewEsdcTscdFormat) {
                            // New format: use sheet name and create appropriate metric info
                            const sheetName = fileData.sheet || disciplineId.toUpperCase();
                            metadata = {
                                discipline: sheetName === 'ESDC' 
                                    ? 'Engineering Services During Construction (ESDC)' 
                                    : 'Technical Support and Coordination (TSCD)',
                                eqtyMetric: { name: 'Anticipated Project Cost', uom: 'K$' },
                                serviceCategory: sheetName
                            };
                        } else {
                            metadata = {
                                discipline: fileData.discipline,
                                eqtyMetric: fileData.eqty_metric,
                                serviceCategory: fileData.service_category
                            };
                        }
                        if (typeof fileData.all_rate === 'number' && Number.isFinite(fileData.all_rate)) metadata.all_rate = fileData.all_rate;
                        if (typeof fileData.all_curve_factor === 'number' && Number.isFinite(fileData.all_curve_factor) && fileData.all_curve_factor > 0) metadata.all_curve_factor = fileData.all_curve_factor;
                        else if (fileData.all_curve && typeof fileData.all_curve.factor === 'number' && Number.isFinite(fileData.all_curve.factor) && fileData.all_curve.factor > 0) metadata.all_curve_factor = fileData.all_curve.factor;
                        if (typeof fileData.selected_curve_factor === 'number' && Number.isFinite(fileData.selected_curve_factor) && fileData.selected_curve_factor > 0) metadata.selected_curve_factor = fileData.selected_curve_factor;
                        else if (fileData.selected_curve && typeof fileData.selected_curve.factor === 'number' && Number.isFinite(fileData.selected_curve.factor) && fileData.selected_curve.factor > 0) metadata.selected_curve_factor = fileData.selected_curve.factor;
                        if (fileData.calc && typeof fileData.calc === 'object') {
                            metadata.calc = {};
                            if (typeof fileData.calc.open === 'number' && Number.isFinite(fileData.calc.open) && fileData.calc.open > 0) metadata.calc.open = fileData.calc.open;
                            if (typeof fileData.calc.custom === 'number' && Number.isFinite(fileData.calc.custom) && fileData.calc.custom > 0) metadata.calc.custom = fileData.calc.custom;
                            if (fileData.calc.custom_from_selected === true || fileData.calc.custom === 'from_selected') metadata.calc.custom_from_selected = true;
                            if (typeof fileData.calc.custom_std_dev_coefficient === 'number' && Number.isFinite(fileData.calc.custom_std_dev_coefficient)) metadata.calc.custom_std_dev_coefficient = fileData.calc.custom_std_dev_coefficient;
                        }
                        loadedData[disciplineId] = {
                            projects: transformedProjects,
                            defaultRate: rateStats.mean,
                            customRate: rateStats.mean,
                            rateStats: rateStats,
                            metadata: metadata
                        };
                    }
                }

                console.log('🔷 Final loadedData keys:', Object.keys(loadedData));
                console.log('🔷 loadedData sample:', Object.keys(loadedData).slice(0, 3).map(k => ({
                    id: k,
                    discipline: loadedData[k].discipline,
                    displayName: loadedData[k].displayName,
                    projectCount: loadedData[k].projects?.length
                })));

                benchmarkDataCache = loadedData;
                benchmarkDataLoaded = true;
                console.log('Benchmark data loaded successfully:', Object.keys(loadedData));
                if (loadedData.esdc) console.log('ESDC projects in cache:', loadedData.esdc.projects?.length);
                if (loadedData.tscd) console.log('TSCD projects in cache:', loadedData.tscd.projects?.length);
                return loadedData;
            })();
            
            return benchmarkLoadPromise;
        }

        /**
         * Get benchmark data for a specific discipline (async)
         */
        async function getBenchmarkData(disciplineId) {
            const data = await loadBenchmarkData();
            return data[disciplineId] || null;
        }

        /**
         * Get benchmark data synchronously (returns cached data or fallback)
         */
        function getBenchmarkDataSync(disciplineId) {
            return benchmarkDataCache[disciplineId] || HISTORICAL_BENCHMARKS[disciplineId] || null;
        }

        // Discipline configuration with account codes and units of measure
        const DISCIPLINE_CONFIG = {
            digitalDelivery: {
                id: 'digitalDelivery',
                name: 'Digital Delivery',
                accountCode: '88.40.26',
                unit: 'K$',
                quantityDescription: 'Anticipated Contract Amount',
                calculationType: 'matrix' // Uses complexity/duration matrix
            },
            drainage: {
                id: 'drainage',
                name: 'Drainage',
                accountCode: '88.40.27',
                unit: 'AC',
                quantityDescription: 'Project Area (Acres)',
                calculationType: 'benchmark'
            },
            environmental: {
                id: 'environmental',
                name: 'Environmental',
                accountCode: '88.40.39',
                unit: 'EA',
                quantityDescription: 'Permit Count',
                calculationType: 'benchmark'
            },
            mot: {
                id: 'mot',
                name: 'MOT',
                accountCode: '88.40.37',
                unit: 'LF',
                quantityDescription: 'Roadway Alignment Length',
                calculationType: 'benchmark'
            },
            roadway: {
                id: 'roadway',
                name: 'Roadway',
                accountCode: '88.40.47, 88.40.39',
                unit: 'LF',
                quantityDescription: 'Roadway Alignment Length',
                calculationType: 'benchmark'
            },
            traffic: {
                id: 'traffic',
                name: 'Traffic',
                accountCode: '88.40.65',
                unit: 'LF',
                quantityDescription: 'Roadway Alignment Length',
                calculationType: 'benchmark'
            },
            utilities: {
                id: 'utilities',
                name: 'Utilities',
                accountCode: '88.40.67',
                unit: 'EA',
                quantityDescription: 'Self-Perform Design Relocations',
                calculationType: 'benchmark'
            },
            retainingWalls: {
                id: 'retainingWalls',
                name: 'Retaining Walls',
                accountCode: '88.40.69',
                unit: 'SF',
                quantityDescription: 'Retaining Wall Area',
                calculationType: 'benchmark'
            },
            noiseWalls: {
                id: 'noiseWalls',
                name: 'Noise Walls',
                accountCode: '88.40.69',
                unit: 'SF',
                quantityDescription: 'Noise Wall Area',
                calculationType: 'benchmark'
            },
            bridgesPCGirder: {
                id: 'bridgesPCGirder',
                name: 'Bridges (PC Girder)',
                accountCode: '88.45.81',
                unit: 'SF',
                quantityDescription: 'Bridge Deck Area',
                calculationType: 'benchmark',
                bridgeType: 'PC Girder'
            },
            bridgesSteel: {
                id: 'bridgesSteel',
                name: 'Bridges (Steel)',
                accountCode: '88.45.81',
                unit: 'SF',
                quantityDescription: 'Bridge Deck Area',
                calculationType: 'benchmark',
                bridgeType: 'Steel'
            },
            bridgesRehab: {
                id: 'bridgesRehab',
                name: 'Bridges (Rehabilitation)',
                accountCode: '88.45.81',
                unit: 'SF',
                quantityDescription: 'Bridge Deck Area',
                calculationType: 'benchmark',
                bridgeType: 'Rehabilitation'
            },
            miscStructures: {
                id: 'miscStructures',
                name: 'Misc Structures',
                accountCode: '88.45.81.036',
                unit: 'MHR',
                quantityDescription: 'RDWY, DRN and TRF MHR',
                calculationType: 'percentage' // % of Roadway + Drainage + Traffic MH
            },
            geotechnical: {
                id: 'geotechnical',
                name: 'Geotechnical',
                accountCode: '88.50',
                unit: 'EA',
                quantityDescription: 'Transportation Structure Count',
                calculationType: 'benchmark'
            },
            systems: {
                id: 'systems',
                name: 'Systems',
                accountCode: '88.35',
                unit: 'TF',
                quantityDescription: 'Track Alignment Length',
                calculationType: 'benchmark'
            },
            track: {
                id: 'track',
                name: 'Track',
                accountCode: '88.40.63',
                unit: 'TF',
                quantityDescription: 'Track Alignment Length',
                calculationType: 'benchmark'
            },
            esdc: {
                id: 'esdc',
                name: 'ESDC',
                accountCode: '',
                unit: 'K$',
                quantityDescription: 'Anticipated Project Cost',
                calculationType: 'percentage' // % of project cost
            },
            tscd: {
                id: 'tscd',
                name: 'TSCD',
                accountCode: '',
                unit: 'K$',
                quantityDescription: 'Anticipated Project Cost',
                calculationType: 'percentage' // % of project cost
            }
        };

        // Historical project benchmark data
        const HISTORICAL_BENCHMARKS = {
            drainage: {
                projects: [
                    { id: 'sec820', name: 'IH 820 Southeast Connector', mh: 141161, quantity: 872, unit: 'AC', rate: 161.88, type: 'highway', complexity: 'high', applicable: true },
                    { id: 'bch1', name: 'BC Highway 1', mh: 2209, quantity: 3, unit: 'AC', rate: 669.39, type: 'highway', complexity: 'medium', applicable: false },
                    { id: 'bch5', name: 'BC Highway 5', mh: 4948, quantity: 16, unit: 'AC', rate: 309.25, type: 'highway', complexity: 'medium', applicable: false },
                    { id: 'fwle', name: 'Federal Way Link Extension', mh: 122527, quantity: 104, unit: 'AC', rate: 1178.14, type: 'transit', complexity: 'high', applicable: false },
                    { id: 'fp2a', name: 'Foothill Phase 2A LRT', mh: 7420, quantity: 133, unit: 'AC', rate: 55.79, type: 'transit', complexity: 'low', applicable: false },
                    { id: 'fp2b1', name: 'Foothill Phase 2B1 LRT', mh: 72738, quantity: 119, unit: 'AC', rate: 611.24, type: 'transit', complexity: 'high', applicable: false },
                    { id: 'i15', name: 'I-15 Tropicana', mh: 14493, quantity: 194, unit: 'AC', rate: 74.71, type: 'highway', complexity: 'medium', applicable: true },
                    { id: 'i17', name: 'I-17 Anthem', mh: 47947, quantity: 2171, unit: 'AC', rate: 22.09, type: 'highway', complexity: 'low', applicable: true },
                    { id: 'ottawa', name: 'Ottawa LRT', mh: 11503, quantity: 560, unit: 'AC', rate: 20.54, type: 'transit', complexity: 'low', applicable: false },
                    { id: 'us97', name: 'US 97', mh: 7787, quantity: 33, unit: 'AC', rate: 235.97, type: 'highway', complexity: 'high', applicable: true },
                    { id: '264th', name: '264th Street Interchange', mh: 11783, quantity: 193, unit: 'AC', rate: 61.05, type: 'highway', complexity: 'medium', applicable: true }
                ],
                defaultRate: 92.62,
                customRate: 81.42
            },
            mot: {
                projects: [
                    { id: 'sec820', name: 'IH 820 Southeast Connector', mh: 170668, quantity: 550674, unit: 'LF', rate: 0.310, type: 'highway', complexity: 'high', applicable: true },
                    { id: 'bch1', name: 'BC Highway 1', mh: 3645, quantity: 1120, unit: 'LF', rate: 3.254, type: 'highway', complexity: 'medium', applicable: false },
                    { id: 'bch5', name: 'BC Highway 5', mh: 1050, quantity: 2300, unit: 'LF', rate: 0.457, type: 'highway', complexity: 'medium', applicable: false },
                    { id: 'fwle', name: 'Federal Way Link Extension', mh: 32305, quantity: 83559, unit: 'LF', rate: 0.387, type: 'transit', complexity: 'medium', applicable: false },
                    { id: 'fp2a', name: 'Foothill Phase 2A LRT', mh: 3500, quantity: 25667, unit: 'LF', rate: 0.136, type: 'transit', complexity: 'low', applicable: false },
                    { id: 'fp2b1', name: 'Foothill Phase 2B1 LRT', mh: 7873, quantity: 17105, unit: 'LF', rate: 0.460, type: 'transit', complexity: 'medium', applicable: false },
                    { id: 'i15', name: 'I-15 Tropicana', mh: 11263, quantity: 48206, unit: 'LF', rate: 0.234, type: 'highway', complexity: 'medium', applicable: true },
                    { id: 'i17', name: 'I-17 Anthem', mh: 13867, quantity: 325987, unit: 'LF', rate: 0.043, type: 'highway', complexity: 'low', applicable: true },
                    { id: 'ottawa', name: 'Ottawa LRT', mh: 72414, quantity: 547047, unit: 'LF', rate: 0.132, type: 'transit', complexity: 'low', applicable: false },
                    { id: 'us97', name: 'US 97', mh: 7364, quantity: 107830, unit: 'LF', rate: 0.068, type: 'highway', complexity: 'low', applicable: true },
                    { id: '264th', name: '264th Street Interchange', mh: 25407, quantity: 51920, unit: 'LF', rate: 0.489, type: 'highway', complexity: 'high', applicable: true }
                ],
                defaultRate: 0.208,
                customRate: 0.184
            },
            roadway: {
                projects: [
                    { id: 'sec820', name: 'IH 820 Southeast Connector', mh: 133332, quantity: 550674, unit: 'LF', rate: 0.242, type: 'highway', complexity: 'medium', applicable: true },
                    { id: 'bch1', name: 'BC Highway 1', mh: 4556, quantity: 1120, unit: 'LF', rate: 4.068, type: 'highway', complexity: 'high', applicable: false },
                    { id: 'bch5', name: 'BC Highway 5', mh: 6097, quantity: 2300, unit: 'LF', rate: 2.651, type: 'highway', complexity: 'high', applicable: false },
                    { id: 'fwle', name: 'Federal Way Link Extension', mh: 74720, quantity: 165248, unit: 'LF', rate: 0.452, type: 'transit', complexity: 'medium', applicable: false },
                    { id: 'fp2a', name: 'Foothill Phase 2A LRT', mh: 13279, quantity: 180566, unit: 'LF', rate: 0.074, type: 'transit', complexity: 'low', applicable: false },
                    { id: 'fp2b1', name: 'Foothill Phase 2B1 LRT', mh: 58164, quantity: 120338, unit: 'LF', rate: 0.483, type: 'transit', complexity: 'medium', applicable: false },
                    { id: 'i15', name: 'I-15 Tropicana', mh: 24245, quantity: 48206, unit: 'LF', rate: 0.503, type: 'highway', complexity: 'high', applicable: true },
                    { id: 'i17', name: 'I-17 Anthem', mh: 53211, quantity: 325987, unit: 'LF', rate: 0.163, type: 'highway', complexity: 'low', applicable: true },
                    { id: 'ottawa', name: 'Ottawa LRT', mh: 192084, quantity: 556235, unit: 'LF', rate: 0.345, type: 'transit', complexity: 'medium', applicable: false },
                    { id: 'tijuana', name: 'Tijuana River Barrier', mh: 547, quantity: 2807, unit: 'LF', rate: 0.195, type: 'highway', complexity: 'medium', applicable: false },
                    { id: '30crossing', name: '30 Crossing', mh: 40907, quantity: 57768, unit: 'LF', rate: 0.708, type: 'highway', complexity: 'high', applicable: true },
                    { id: 'chpe', name: 'CHPE Transmission', mh: 3410, quantity: 23450, unit: 'LF', rate: 0.145, type: 'utility', complexity: 'medium', applicable: false },
                    { id: 'us97', name: 'US 97', mh: 21330, quantity: 102183, unit: 'LF', rate: 0.209, type: 'highway', complexity: 'medium', applicable: true },
                    { id: '264th', name: '264th Street Interchange', mh: 26964, quantity: 51920, unit: 'LF', rate: 0.519, type: 'highway', complexity: 'high', applicable: true }
                ],
                defaultRate: 0.336,
                customRate: 0.390
            },
            traffic: {
                projects: [
                    { id: 'sec820', name: 'IH 820 Southeast Connector', mh: 43833, quantity: 550674, unit: 'LF', rate: 0.080, type: 'highway', complexity: 'low', applicable: true },
                    { id: 'fwle', name: 'Federal Way Link Extension', mh: 42037, quantity: 83559, unit: 'LF', rate: 0.503, type: 'transit', complexity: 'high', applicable: false },
                    { id: 'fp2a', name: 'Foothill Phase 2A LRT', mh: 4284, quantity: 25667, unit: 'LF', rate: 0.167, type: 'transit', complexity: 'medium', applicable: false },
                    { id: 'fp2b1', name: 'Foothill Phase 2B1 LRT', mh: 12410, quantity: 17105, unit: 'LF', rate: 0.726, type: 'transit', complexity: 'high', applicable: false },
                    { id: 'i15', name: 'I-15 Tropicana', mh: 27602, quantity: 48206, unit: 'LF', rate: 0.573, type: 'highway', complexity: 'high', applicable: true },
                    { id: 'i17', name: 'I-17 Anthem', mh: 12223, quantity: 325987, unit: 'LF', rate: 0.037, type: 'highway', complexity: 'low', applicable: true },
                    { id: '30crossing', name: '30 Crossing', mh: 18882, quantity: 57768, unit: 'LF', rate: 0.327, type: 'highway', complexity: 'medium', applicable: true },
                    { id: 'us97', name: 'US 97', mh: 1803, quantity: 102183, unit: 'LF', rate: 0.018, type: 'highway', complexity: 'low', applicable: true },
                    { id: '264th', name: '264th Street Interchange', mh: 5649, quantity: 51920, unit: 'LF', rate: 0.109, type: 'highway', complexity: 'medium', applicable: true }
                ],
                defaultRate: 0.147,
                customRate: 0.124
            },
            utilities: {
                projects: [
                    { id: 'sec820', name: 'IH 820 Southeast Connector', mh: 108899, quantity: 384, unit: 'EA', rate: 283.591, type: 'highway', complexity: 'high', applicable: true },
                    { id: 'fp2b1', name: 'Foothill Phase 2B1 LRT', mh: 18896, quantity: 70, unit: 'EA', rate: 269.943, type: 'transit', complexity: 'medium', applicable: false },
                    { id: 'i15', name: 'I-15 Tropicana', mh: 6374, quantity: 48, unit: 'EA', rate: 132.792, type: 'highway', complexity: 'low', applicable: true },
                    { id: 'us97', name: 'US 97', mh: 3336, quantity: 11, unit: 'EA', rate: 303.273, type: 'highway', complexity: 'high', applicable: true },
                    { id: '264th', name: '264th Street Interchange', mh: 1465, quantity: 5, unit: 'EA', rate: 293.000, type: 'highway', complexity: 'high', applicable: true }
                ],
                defaultRate: 270.727,
                customRate: 269.208
            },
            retainingWalls: {
                projects: [
                    { id: 'sec820', name: 'IH 820 Southeast Connector', mh: 48960, quantity: 1169432, unit: 'SF', rate: 0.042, type: 'highway', complexity: 'low', applicable: true },
                    { id: 'fwle', name: 'Federal Way Link Extension', mh: 54751, quantity: 434037, unit: 'SF', rate: 0.126, type: 'transit', complexity: 'high', applicable: false },
                    { id: 'fp2b1', name: 'Foothill Phase 2B1 LRT', mh: 18592, quantity: 377619, unit: 'SF', rate: 0.049, type: 'transit', complexity: 'low', applicable: false },
                    { id: 'i15', name: 'I-15 Tropicana', mh: 4724, quantity: 95796, unit: 'SF', rate: 0.049, type: 'highway', complexity: 'low', applicable: true },
                    { id: '30crossing', name: '30 Crossing', mh: 3905, quantity: 42336, unit: 'SF', rate: 0.092, type: 'highway', complexity: 'medium', applicable: true },
                    { id: 'us97', name: 'US 97', mh: 696, quantity: 30039, unit: 'SF', rate: 0.023, type: 'highway', complexity: 'low', applicable: true }
                ],
                defaultRate: 0.062,
                customRate: 0.046
            },
            noiseWalls: {
                projects: [
                    { id: 'sec820', name: 'IH 820 Southeast Connector', mh: 10909, quantity: 190048, unit: 'SF', rate: 0.057, type: 'highway', complexity: 'medium', applicable: true },
                    { id: 'fp2b1', name: 'Foothill Phase 2B1 LRT', mh: 5339, quantity: 241020, unit: 'SF', rate: 0.022, type: 'transit', complexity: 'low', applicable: true }
                ],
                defaultRate: 0.040,
                customRate: 0.040
            },
            bridgesPCGirder: {
                projects: [
                    { id: 'b201', name: 'Bridge B201 (429 Ramp B1)', mh: 2415, quantity: 18100, unit: 'SF', rate: 0.1334, type: 'highway', complexity: 'medium', spans: 3, applicable: true },
                    { id: 'b203', name: 'Bridge B203 (429 Ramp A2)', mh: 2438, quantity: 19630, unit: 'SF', rate: 0.1242, type: 'highway', complexity: 'medium', spans: 4, applicable: true },
                    { id: 'b221', name: 'Bridge B221 (429 Ramp D2)', mh: 2487, quantity: 22888, unit: 'SF', rate: 0.1087, type: 'highway', complexity: 'medium', spans: 5, applicable: true },
                    { id: 'b222', name: 'Bridge B222 (SR 538 NB)', mh: 3006, quantity: 57246, unit: 'SF', rate: 0.0525, type: 'highway', complexity: 'low', spans: 10, applicable: true },
                    { id: 'b207', name: 'Bridge B207 (Old Lake Wilson SB)', mh: 2510, quantity: 24431, unit: 'SF', rate: 0.1028, type: 'highway', complexity: 'medium', spans: 4, applicable: true },
                    { id: 'b209', name: 'Bridge B209 (429 Ramp D2)', mh: 2827, quantity: 45408, unit: 'SF', rate: 0.0623, type: 'highway', complexity: 'low', spans: 6, applicable: true },
                    { id: 'b210', name: 'Bridge B210 (SR 538 NB)', mh: 2424, quantity: 18692, unit: 'SF', rate: 0.1297, type: 'highway', complexity: 'medium', spans: 4, applicable: true },
                    { id: 'b212', name: 'Bridge B212 (429 Ramp D3)', mh: 2465, quantity: 21451, unit: 'SF', rate: 0.1149, type: 'highway', complexity: 'medium', spans: 5, applicable: true },
                    { id: 'b213', name: 'Bridge B213 (I-4 ML WB)', mh: 2577, quantity: 28872, unit: 'SF', rate: 0.0893, type: 'highway', complexity: 'medium', spans: 3, applicable: true },
                    { id: 'b214', name: 'Bridge B214 (I-4 ML EB)', mh: 2580, quantity: 29063, unit: 'SF', rate: 0.0888, type: 'highway', complexity: 'medium', spans: 3, applicable: true }
                ],
                defaultRate: 0.090,
                customRate: 0.090
            },
            bridgesSteel: {
                projects: [
                    { id: 'frt', name: 'FRT San Dimas Wash', mh: 2093, quantity: 1901, unit: 'SF', rate: 1.1013, type: 'transit', complexity: 'high', spans: 1, applicable: false },
                    { id: 'd12', name: 'I-15 Tropicana D12', mh: 5094, quantity: 13562, unit: 'SF', rate: 0.3756, type: 'highway', complexity: 'high', spans: 'multi', applicable: true },
                    { id: 'b221s', name: 'Bridge B221 Steel (429 Ramp D2)', mh: 4064, quantity: 10820, unit: 'SF', rate: 0.3756, type: 'highway', complexity: 'high', spans: 1, applicable: true },
                    { id: 'b222s', name: 'Bridge B222 Steel (SR 538 NB)', mh: 4141, quantity: 11025, unit: 'SF', rate: 0.3756, type: 'highway', complexity: 'high', spans: 1, applicable: true }
                ],
                defaultRate: 0.376,
                customRate: 0.376
            },
            bridgesRehab: {
                projects: [
                    { id: 'b208', name: 'Bridge B208 (Old Lake Wilson NB Rehab)', mh: 4692, quantity: 30000, unit: 'SF', rate: 0.1564, type: 'highway', complexity: 'medium', applicable: true }
                ],
                defaultRate: 0.156,
                customRate: 0.156
            },
            miscStructures: {
                projects: [
                    { id: 'sec820', name: 'IH 820 Southeast Connector', mh: 19110, quantity: 378295, unit: 'MHR', rate: 0.051, type: 'highway', complexity: 'medium', applicable: true },
                    { id: 'bch1', name: 'BC Highway 1', mh: 738, quantity: 6765, unit: 'MHR', rate: 0.109, type: 'highway', complexity: 'high', applicable: false },
                    { id: 'fwle', name: 'Federal Way Link Extension', mh: 9945, quantity: 294035, unit: 'MHR', rate: 0.034, type: 'transit', complexity: 'low', applicable: false },
                    { id: 'fp2b1', name: 'Foothill Phase 2B1 LRT', mh: 12927, quantity: 166681, unit: 'MHR', rate: 0.078, type: 'transit', complexity: 'medium', applicable: false },
                    { id: 'i15', name: 'I-15 Tropicana', mh: 4145, quantity: 71064, unit: 'MHR', rate: 0.058, type: 'highway', complexity: 'medium', applicable: true },
                    { id: 'i17', name: 'I-17 Anthem', mh: 5004, quantity: 113381, unit: 'MHR', rate: 0.044, type: 'highway', complexity: 'low', applicable: true },
                    { id: '264th', name: '264th Street Interchange', mh: 1945, quantity: 44396, unit: 'MHR', rate: 0.044, type: 'highway', complexity: 'low', applicable: true }
                ],
                defaultRate: 0.058,
                customRate: 0.048
            },
            geotechnical: {
                projects: [
                    { id: 'sec820', name: 'IH 820 Southeast Connector', mh: 47629, quantity: 274, unit: 'EA', rate: 173.828, type: 'highway', complexity: 'medium', applicable: true },
                    { id: 'bch1', name: 'BC Highway 1', mh: 1255, quantity: 2, unit: 'EA', rate: 627.500, type: 'highway', complexity: 'high', applicable: false },
                    { id: 'bch5', name: 'BC Highway 5', mh: 4735, quantity: 8, unit: 'EA', rate: 591.875, type: 'highway', complexity: 'high', applicable: false },
                    { id: 'fwle', name: 'Federal Way Link Extension', mh: 33353, quantity: 127, unit: 'EA', rate: 262.622, type: 'transit', complexity: 'medium', applicable: false },
                    { id: 'fp2a', name: 'Foothill Phase 2A LRT', mh: 6797, quantity: 19, unit: 'EA', rate: 357.737, type: 'transit', complexity: 'high', applicable: false },
                    { id: 'fp2b1', name: 'Foothill Phase 2B1 LRT', mh: 98819, quantity: 99, unit: 'EA', rate: 998.172, type: 'transit', complexity: 'high', applicable: false },
                    { id: 'i15', name: 'I-15 Tropicana', mh: 9508, quantity: 33, unit: 'EA', rate: 288.121, type: 'highway', complexity: 'medium', applicable: true },
                    { id: 'i17', name: 'I-17 Anthem', mh: 23572, quantity: 110, unit: 'EA', rate: 214.291, type: 'highway', complexity: 'medium', applicable: true },
                    { id: 'tijuana', name: 'Tijuana River Barrier', mh: 951, quantity: 1, unit: 'EA', rate: 951.000, type: 'highway', complexity: 'high', applicable: false },
                    { id: 'us97', name: 'US 97', mh: 2900, quantity: 19, unit: 'EA', rate: 152.632, type: 'highway', complexity: 'low', applicable: true },
                    { id: '264th', name: '264th Street Interchange', mh: 7478, quantity: 6, unit: 'EA', rate: 1246.333, type: 'highway', complexity: 'high', applicable: false }
                ],
                defaultRate: 327.683,
                customRate: 201.730
            },
            systems: {
                projects: [
                    { id: 'fwle', name: 'Federal Way Link Extension', mh: 153825, quantity: 81688, unit: 'TF', rate: 1.883, type: 'transit', complexity: 'high', applicable: true },
                    { id: 'fp2a', name: 'Foothill Phase 2A LRT', mh: 39239, quantity: 154899, unit: 'TF', rate: 0.253, type: 'transit', complexity: 'low', applicable: true },
                    { id: 'fp2b1', name: 'Foothill Phase 2B1 LRT', mh: 88715, quantity: 103233, unit: 'TF', rate: 0.859, type: 'transit', complexity: 'medium', applicable: true },
                    { id: 'ottawa', name: 'Ottawa LRT', mh: 135270, quantity: 167537, unit: 'TF', rate: 0.807, type: 'transit', complexity: 'medium', applicable: false }
                ],
                defaultRate: 0.998,
                customRate: 0.998
            },
            track: {
                projects: [
                    { id: 'fwle', name: 'Federal Way Link Extension', mh: 55340, quantity: 81688, unit: 'TF', rate: 0.677, type: 'transit', complexity: 'high', applicable: true },
                    { id: 'fp2a', name: 'Foothill Phase 2A LRT', mh: 8757, quantity: 154899, unit: 'TF', rate: 0.057, type: 'transit', complexity: 'low', applicable: true },
                    { id: 'fp2b1', name: 'Foothill Phase 2B1 LRT', mh: 6838, quantity: 103233, unit: 'TF', rate: 0.066, type: 'transit', complexity: 'low', applicable: true },
                    { id: 'ottawa', name: 'Ottawa LRT', mh: 82275, quantity: 167537, unit: 'TF', rate: 0.491, type: 'transit', complexity: 'medium', applicable: false }
                ],
                defaultRate: 0.267,
                customRate: 0.267
            },
            esdc: {
                projects: [
                    { id: 'sec820', name: 'IH 820 Southeast Connector', cost: 23053.57, projectCost: 1938485.07, unit: 'K$', rate: 0.0119, market: 'Transportation, Highway', applicable: true },
                    { id: 'fwle', name: 'Federal Way Link Extension', cost: 21188.27, projectCost: 1376998.17, unit: 'K$', rate: 0.0154, market: 'Transit, Light Rail', applicable: false },
                    { id: 'fp2a', name: 'Foothill Phase 2A LRT', cost: 6232.00, projectCost: 470813.24, unit: 'K$', rate: 0.0132, market: 'Transit, Light Rail', applicable: false },
                    { id: 'fp2b1', name: 'Foothill Phase 2B1 LRT', cost: 8894.15, projectCost: 836559.23, unit: 'K$', rate: 0.0106, market: 'Transit, Light Rail', applicable: false },
                    { id: 'ottawa', name: 'Ottawa LRT', cost: 52312.47, projectCost: 3691276.90, unit: 'K$', rate: 0.0142, market: 'Transit, Light Rail', applicable: false },
                    { id: 'c70', name: 'C-70', cost: 15995.50, projectCost: 1386636.60, unit: 'K$', rate: 0.0115, market: 'Transportation, Highway', applicable: true },
                    { id: 'i25trex', name: 'I-25 T-REX', cost: 9702.70, projectCost: 1144655.05, unit: 'K$', rate: 0.0085, market: 'Transportation, Highway', applicable: true },
                    { id: 'geneva', name: 'Geneva Road', cost: 347.60, projectCost: 41533.16, unit: 'K$', rate: 0.0084, market: 'Transportation, Highway', applicable: true },
                    { id: 'i15corr', name: 'I-15 Corridor Reconstruction', cost: 10453.15, projectCost: 1261222.85, unit: 'K$', rate: 0.0083, market: 'Transportation, Highway', applicable: true },
                    { id: 'sr202', name: 'SR-202', cost: 1276.02, projectCost: 155588.42, unit: 'K$', rate: 0.0082, market: 'Transportation, Highway', applicable: true },
                    { id: 'dfw', name: 'DFW Connector', cost: 6439.08, projectCost: 798052.80, unit: 'K$', rate: 0.0081, market: 'Transportation, Highway', applicable: true },
                    { id: 'neon', name: 'Project Neon', cost: 5539.52, projectCost: 611670.06, unit: 'K$', rate: 0.0091, market: 'Transportation, Highway', applicable: true },
                    { id: 'mvc', name: 'Mountain View Corridor', cost: 2199.24, projectCost: 229878.60, unit: 'K$', rate: 0.0096, market: 'Transportation, Highway', applicable: true },
                    { id: 'e360', name: 'E-360 Bellevue to Redmond', cost: 2290.37, projectCost: 236570.04, unit: 'K$', rate: 0.0097, market: 'Transportation, Highway', applicable: true },
                    { id: 'i17', name: 'I-17 Anthem', cost: 3210.57, projectCost: 320071.89, unit: 'K$', rate: 0.0100, market: 'Transportation, Highway', applicable: true },
                    { id: 'henday', name: 'Anthony Henday-Stony Plain', cost: 1905.94, projectCost: 187397.98, unit: 'K$', rate: 0.0102, market: 'Transportation, Highway', applicable: true },
                    { id: 'sh183', name: 'SH-183 Midtown Express', cost: 9424.17, projectCost: 885258.97, unit: 'K$', rate: 0.0106, market: 'Transportation, Highway', applicable: true },
                    { id: 'iccb', name: 'ICC-B', cost: 5009.29, projectCost: 454376.58, unit: 'K$', rate: 0.0110, market: 'Transportation, Highway', applicable: true },
                    { id: 'pioneer', name: 'Pioneer Crossing', cost: 2102.32, projectCost: 177230.46, unit: 'K$', rate: 0.0119, market: 'Transportation, Highway', applicable: true },
                    { id: 'i225', name: 'I-225', cost: 5263.24, projectCost: 424701.71, unit: 'K$', rate: 0.0124, market: 'Transportation, Highway', applicable: true },
                    { id: 'i405rb', name: 'I-405 Renton to Bellevue', cost: 8305.85, projectCost: 615922.00, unit: 'K$', rate: 0.0135, market: 'Transportation, Highway', applicable: true },
                    { id: 'nwpkwy', name: 'Northwest Parkway', cost: 2059.46, projectCost: 152435.75, unit: 'K$', rate: 0.0135, market: 'Transportation, Highway', applicable: true },
                    { id: 'i15trop', name: 'I-15 Tropicana', cost: 4650.13, projectCost: 328887.12, unit: 'K$', rate: 0.0141, market: 'Transportation, Highway', applicable: true },
                    { id: 'turcot', name: 'Turcot', cost: 24752.38, projectCost: 1703515.46, unit: 'K$', rate: 0.0145, market: 'Transportation, Highway', applicable: true },
                    { id: 'selmon', name: 'Selmon Expressway Extension', cost: 4154.99, projectCost: 253154.83, unit: 'K$', rate: 0.0164, market: 'Transportation, Highway', applicable: true },
                    { id: 'swcalgary', name: 'Southwest Calgary Ring Road', cost: 23281.64, projectCost: 1325890.67, unit: 'K$', rate: 0.0176, market: 'Transportation, Highway', applicable: true },
                    { id: 'sea2sky', name: 'Sea-to-Sky Highway', cost: 3379.41, projectCost: 590638.34, unit: 'K$', rate: 0.0057, market: 'Transportation, Highway', applicable: true },
                    { id: 'i405k', name: 'I-405 Kirkland', cost: 247.45, projectCost: 42990.54, unit: 'K$', rate: 0.0058, market: 'Transportation, Highway', applicable: true },
                    { id: 'i440', name: 'I-440 Nashville Connector', cost: 520.87, projectCost: 146656.02, unit: 'K$', rate: 0.0036, market: 'Transportation, Highway', applicable: true }
                ],
                defaultRate: 0.0099,
                customRate: 0.0103
            },
            // TSCD fallback: same as ESDC — full list with only "Applicable Job" = Yes selected (match TSCD_HI.json)
            tscd: {
                projects: [
                    { id: 'sec820', name: 'IH 820 Southeast Connector', cost: 7812.04, projectCost: 2006033.03, unit: 'K$', rate: 0.0039, market: 'Transportation, Highway', applicable: true },
                    { id: 'connect4', name: 'Connect 4', cost: 1491.45, projectCost: 268033.92, unit: 'K$', rate: 0.0056, market: 'Transportation, Highway', applicable: true },
                    { id: 'i15trop', name: 'I-15 Tropicana', cost: 830.59, projectCost: 368187.07, unit: 'K$', rate: 0.0023, market: 'Transportation, Highway', applicable: true },
                    { id: 'c70', name: 'C-70', cost: 7441.71, projectCost: 1290640.68, unit: 'K$', rate: 0.0058, market: 'Transportation, Highway', applicable: true },
                    { id: 'turcot', name: 'Turcot', cost: 9542.25, projectCost: 1784779.80, unit: 'K$', rate: 0.0053, market: 'Transportation, Highway', applicable: true },
                    { id: 'swcalgary', name: 'Southwest Calgary Ring Road', cost: 2905.56, projectCost: 1310255.12, unit: 'K$', rate: 0.0022, market: 'Transportation, Highway', applicable: true },
                    { id: 'goethals', name: 'Goethals Bridge Replacement', cost: 1935.06, projectCost: 1091231.60, unit: 'K$', rate: 0.0018, market: 'Transportation, Bridges', applicable: true },
                    { id: 'midtown', name: 'Midtown Express', cost: 1552.51, projectCost: 914940.51, unit: 'K$', rate: 0.0017, market: 'Transportation, Highway', applicable: false },
                    { id: 'bwe', name: 'Border West Expressway', cost: 1858.64, projectCost: 691683.83, unit: 'K$', rate: 0.0027, market: 'Transportation, Highway', applicable: false },
                    { id: 'neon', name: 'Project Neon', cost: 931.75, projectCost: 628296.99, unit: 'K$', rate: 0.0015, market: 'Transportation, Highway', applicable: false },
                    { id: '30crossing', name: '30 Crossing', cost: 1551.47, projectCost: 497061.58, unit: 'K$', rate: 0.0031, market: 'Transportation, Bridges', applicable: false },
                    { id: 'selmon', name: 'Selmon Expressway Extension', cost: 1955.92, projectCost: 262650.00, unit: 'K$', rate: 0.0074, market: 'Transportation, Highway', applicable: false },
                    { id: 'flyway470', name: 'Flyway 470', cost: 898.39, projectCost: 256515.18, unit: 'K$', rate: 0.0035, market: 'Transportation, Highway', applicable: false },
                    { id: 'mvc', name: 'MVC 4100 South to SR-201', cost: 131.57, projectCost: 229983.74, unit: 'K$', rate: 0.0006, market: 'Transportation, Highway', applicable: false },
                    { id: 'tlicho', name: 'Tlicho All-Season Road', cost: 216.41, projectCost: 183706.28, unit: 'K$', rate: 0.0012, market: 'Transportation, Highway', applicable: false },
                    { id: 'i10cap', name: 'I-10 Capital Corridor', cost: 1776.12, projectCost: 159847.91, unit: 'K$', rate: 0.0111, market: 'Transportation, Highway', applicable: false },
                    { id: 'nashville', name: 'Nashville Connector', cost: 361.46, projectCost: 148878.92, unit: 'K$', rate: 0.0024, market: 'Transportation, Bridges', applicable: false },
                    { id: 'moosejaw', name: 'Moosejaw', cost: 759.58, projectCost: 148722.83, unit: 'K$', rate: 0.0051, market: 'Transportation, Highway', applicable: false },
                    { id: 'bigthompson', name: 'Big Thompson', cost: 235.58, projectCost: 146038.94, unit: 'K$', rate: 0.0016, market: 'Transportation, Highway', applicable: false },
                    { id: 'kingston', name: 'Kingston Third Crossing', cost: 1140.54, projectCost: 144336.50, unit: 'K$', rate: 0.0079, market: 'Transportation, Bridges', applicable: false },
                    { id: 'porter', name: 'Porter Road', cost: 770.65, projectCost: 112340.79, unit: 'K$', rate: 0.0069, market: 'Transportation, Highway', applicable: false }
                ],
                defaultRate: 0.0026,
                customRate: 0.0031
            },
            environmental: {
                projects: [
                    { id: 'sec820', name: 'IH 820 Southeast Connector', mh: 1050, quantity: 3, unit: 'EA', rate: 350.000, type: 'highway', complexity: 'medium', applicable: true }
                ],
                defaultRate: 350.000,
                customRate: 350.000
            }
        };

        // Digital Delivery complexity matrix (MH by complexity score and duration)
        const DIGITAL_DELIVERY_MATRIX = {
            // Design Duration (months) -> PRA Score ranges -> MH
            durations: [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24],
            complexityScores: {
                1: [260, 303, 348, 389, 433, 476, 519, 562, 606, 649, 692, 735, 779, 822, 865, 908, 952, 995, 1038],
                2: [519, 606, 692, 779, 865, 952, 1038, 1125, 1211, 1298, 1384, 1471, 1557, 1644, 1730, 1817, 1903, 1990, 2076],
                4: [1308, 1211, 1384, 1557, 1730, 1903, 2076, 2249, 2422, 2595, 2768, 2941, 3114, 3287, 3460, 3633, 3806, 3979, 4152],
                8: [1661, 1938, 2214, 2491, 2768, 3045, 3322, 3598, 3875, 4152, 4429, 4706, 4982, 5259, 5536, 5813, 6090, 6366, 6643],
                16: [1817, 2119, 2422, 2725, 3028, 3330, 3633, 3936, 4239, 4541, 4844, 5147, 5450, 5752, 6055, 6358, 6661, 6963, 7266],
                24: [2076, 2422, 2768, 3114, 3460, 3806, 4152, 4498, 4844, 5190, 5536, 5882, 6228, 6574, 6920, 7266, 7612, 7958, 8304]
            },
            // Size-based complexity scoring
            sizeScores: {
                '<$100M': 1,
                '$100M-$200M': 2,
                '$200M-$400M': 3,
                '$400M-$700M': 6,
                '$700M-$1B': 10,
                '>$1B': 12
            },
            // Complexity multipliers
            complexityMultipliers: {
                'Low': { 1: 1, 2: 2, 3: 3, 6: 6, 10: 10, 12: 12 },
                'Low-Med': { 1: 2, 2: 4, 3: 6, 6: 12, 10: 20, 12: 24 },
                'Med': { 1: 4, 2: 8, 3: 12, 6: 24, 10: 40, 12: 48 },
                'Med-High': { 1: 8, 2: 16, 3: 24, 6: 48, 10: 80, 12: 96 },
                'High': { 1: 16, 2: 32, 3: 48, 6: 96, 10: 160, 12: 192 }
            }
        };

        // MH Estimate state
        let mhEstimateState = {
            projectCost: 0,
            designDuration: 20,
            complexity: 'Med',
            disciplines: {},
            selectedProjects: {},
            customRates: {}
        };

        // ============================================
        // MH ESTIMATION FUNCTIONS
        // ============================================

        /**
         * Get applicable projects for a discipline based on project type and complexity
         * Uses dynamically loaded benchmark data from JSON files
         * @param {string} disciplineId - The discipline ID from DISCIPLINE_CONFIG
         * @param {string} projectType - 'highway', 'transit', 'utility', etc.
         * @param {string} complexity - 'low', 'medium', 'high'
         * @returns {Array} Array of applicable project objects
         */
        function getApplicableProjects(disciplineId, projectType = 'highway', complexity = null) {
            // First try dynamically loaded data, then fall back to static
            const benchmarks = getBenchmarkDataSync(disciplineId);
            if (!benchmarks || !benchmarks.projects) return [];
            
            return benchmarks.projects.filter(project => {
                // If project has explicit applicable flag, use that first
                if (project.applicable !== undefined) {
                    return project.applicable;
                }
                // Otherwise filter by project type
                if (projectType && project.type && project.type !== projectType) {
                    return false;
                }
                // Filter by complexity if specified
                if (complexity && project.complexity && project.complexity !== complexity) {
                    return false;
                }
                return true;
            });
        }

        /**
         * Calculate weighted production rate from selected projects
         * @param {Array} projects - Array of project objects with mh, quantity, rate
         * @param {string} method - 'average', 'weighted', 'median', 'statistical'
         * @returns {number} Calculated production rate
         */
        function calculateWeightedRate(projects, method = 'weighted') {
            if (!projects || projects.length === 0) return 0;
            
            if (method === 'average') {
                const sum = projects.reduce((acc, p) => acc + (p.rate || 0), 0);
                return sum / projects.length;
            }
            
            if (method === 'median') {
                const sorted = [...projects].sort((a, b) => (a.rate || 0) - (b.rate || 0));
                const mid = Math.floor(sorted.length / 2);
                return sorted.length % 2 ? sorted[mid].rate : (sorted[mid - 1].rate + sorted[mid].rate) / 2;
            }
            
            if (method === 'statistical') {
                // Use mean from statistical analysis
                const stats = BenchmarkStats.calculateRateStats(projects);
                return stats.mean;
            }
            
            // Weighted by quantity (default)
            const totalQuantity = projects.reduce((acc, p) => acc + (p.quantity || 0), 0);
            const totalMH = projects.reduce((acc, p) => acc + (p.mh || 0), 0);
            return totalQuantity > 0 ? totalMH / totalQuantity : 0;
        }

        /**
         * Estimate MH for a discipline based on quantity and benchmark rate
         * Uses avg ± std_dev formula for statistical estimation
         * @param {string} disciplineId - The discipline ID
         * @param {number} quantity - The quantity in the discipline's UOM
         * @param {Array} selectedProjects - Optional specific projects to use for rate
         * @param {boolean} useStatistical - If true, use statistical bounds (avg ± std_dev)
         * @returns {Object} { mh: number, rate: number, projects: Array, bounds?: Object }
         */
        function estimateMH(disciplineId, quantity, selectedProjects = null, useStatistical = true) {
            const config = DISCIPLINE_CONFIG[disciplineId];
            // Use dynamic benchmark data (loaded from JSON)
            const benchmarks = getBenchmarkDataSync(disciplineId);
            
            if (!config) {
                return { mh: 0, rate: 0, projects: [], error: 'Unknown discipline' };
            }
            
            // If benchmark data hasn't loaded yet, return placeholder
            if (!benchmarks) {
                return { 
                    mh: 0, 
                    rate: 0, 
                    projects: [], 
                    loading: true,
                    error: 'Benchmark data loading...' 
                };
            }
            
            // Get projects to use for rate calculation
            const projects = selectedProjects || getApplicableProjects(disciplineId);
            
            // For benchmark (non-revenue) disciplines with quantity: use regression curves
            const isRevenueBased = (disciplineId === 'esdc' || disciplineId === 'tscd');
            const useCurves = !isRevenueBased && quantity > 0 && (config.calculationType === 'benchmark' || benchmarks.projects?.length >= 2);
            
            let rate, allRate, bounds = null;
            
            if (useCurves) {
                const selectedCurveRate = getRateFromSelectedProjectsCurve(disciplineId, quantity);
                const allCurveRate = getRateFromAllProjectsCurve(disciplineId, quantity);
                if (selectedCurveRate != null && selectedCurveRate > 0) {
                    rate = selectedCurveRate;
                    allRate = (allCurveRate != null && allCurveRate > 0) ? allCurveRate : (BenchmarkStats.calculateRateStats(benchmarks.projects).mean);
                } else {
                    allRate = (allCurveRate != null && allCurveRate > 0) ? allCurveRate : (BenchmarkStats.calculateRateStats(benchmarks.projects).mean);
                    if (useStatistical && projects.length >= 2) {
                        const rateStats = BenchmarkStats.calculateRateStats(projects);
                        rate = rateStats.mean;
                        bounds = BenchmarkStats.estimateWithBounds(quantity, rateStats);
                    } else {
                        rate = projects.length > 0 ? calculateWeightedRate(projects) : benchmarks.customRate || benchmarks.defaultRate;
                    }
                }
            } else if (useStatistical && projects.length >= 2) {
                const rateStats = BenchmarkStats.calculateRateStats(projects);
                rate = rateStats.mean;
                allRate = benchmarks.projects?.length > 0 ? BenchmarkStats.calculateRateStats(benchmarks.projects).mean : rate;
                bounds = BenchmarkStats.estimateWithBounds(quantity, rateStats);
            } else {
                rate = projects.length > 0 ? calculateWeightedRate(projects) : benchmarks.customRate || benchmarks.defaultRate;
                allRate = benchmarks.projects?.length > 0 ? BenchmarkStats.calculateRateStats(benchmarks.projects).mean : rate;
            }
            
            // Calculate MH
            const mh = quantity * rate;
            
            return {
                mh: Math.round(mh),
                rate: rate,
                allRate: allRate,
                projects: projects,
                quantity: quantity,
                unit: config.unit,
                bounds: bounds,
                // Include statistical info
                rateStats: bounds ? {
                    mean: bounds.mean,
                    stdDev: bounds.stdDev,
                    range: bounds.range,
                    lower: bounds.lower,
                    upper: bounds.upper
                } : null
            };
        }

        /**
         * Calculate Digital Delivery MH using the 3-step process from JSON data
         * Step 1: Check Assumed Construction Cost against size ranges, use Medium complexity to get score
         * Step 2: Check complexity score against PRA Score ranges to find the column
         * Step 3: Use Design Duration to find the row, get MH from intersection
         * @param {number} assumedConstructionCostM - Assumed construction cost in millions ($M)
         * @param {number} durationMonths - Design duration in months
         * @param {string} complexityGroup - 'Low', 'Low-Med', 'Med', 'Med-High', 'High' (default: 'Med')
         * @returns {Object} { mh, complexityScore, praColumn, rawLabor, burden, gna, margin, revenue }
         */
        function calculateDigitalDeliveryMH(assumedConstructionCostM, durationMonths, complexityGroup = 'Med') {
            // Default hourly rate for Digital Delivery
            const hourlyRate = 68;
            
            // Get cost calculation parameters
            const burdenRate = parseFloat(document.getElementById('unified-burden')?.value) || 66;
            const gnaRate = parseFloat(document.getElementById('unified-gna')?.value) || 104;
            const kieMultiplier = parseFloat(document.getElementById('calc-kie-multiplier')?.value) || 2.85;
            const marginPercent = (kieMultiplier - 1 - (burdenRate / 100) - (gnaRate / 100)) * 100;
            
            // ============================================
            // STEP 1: Determine complexity score from size range
            // ============================================
            // Size ranges in millions: <$100M, $100M-$200M, $200M-$400M, $400M-$700M, $700M-$1B, >$1B
            // For Medium complexity, use col_4 values: 4, 8, 12, 24, 40, 48
            
            // Complexity columns: Low=col_2, Low-Med=col_3, Med=col_4, Med-High=col_5, High=col_6
            const complexityColMap = {
                'Low': 'col_2',
                'Low-Med': 'col_3', 
                'Med': 'col_4',
                'Med-High': 'col_5',
                'High': 'col_6'
            };
            const complexityCol = complexityColMap[complexityGroup] || 'col_4';
            
            // Size ranges and their complexity scores for Medium (col_4)
            // Based on JSON rows 5-10 (indices 4-9)
            let complexityScore = 4; // Default for <$100M with Medium
            
            if (assumedConstructionCostM >= 1000) {
                // >$1B -> row 10 (index 9), col_4 = 48
                complexityScore = complexityGroup === 'Low' ? 12 : complexityGroup === 'Low-Med' ? 24 : 
                                  complexityGroup === 'Med' ? 48 : complexityGroup === 'Med-High' ? 96 : 192;
            } else if (assumedConstructionCostM >= 700) {
                // $700M-$1B -> row 9 (index 8), col_4 = 40
                complexityScore = complexityGroup === 'Low' ? 10 : complexityGroup === 'Low-Med' ? 20 : 
                                  complexityGroup === 'Med' ? 40 : complexityGroup === 'Med-High' ? 80 : 160;
            } else if (assumedConstructionCostM >= 400) {
                // $400M-$700M -> row 8 (index 7), col_4 = 24
                complexityScore = complexityGroup === 'Low' ? 6 : complexityGroup === 'Low-Med' ? 12 : 
                                  complexityGroup === 'Med' ? 24 : complexityGroup === 'Med-High' ? 48 : 96;
            } else if (assumedConstructionCostM >= 200) {
                // $200M-$400M -> row 7 (index 6), col_4 = 12
                complexityScore = complexityGroup === 'Low' ? 3 : complexityGroup === 'Low-Med' ? 6 : 
                                  complexityGroup === 'Med' ? 12 : complexityGroup === 'Med-High' ? 24 : 48;
            } else if (assumedConstructionCostM >= 100) {
                // $100M-$200M -> row 6 (index 5), col_4 = 8
                complexityScore = complexityGroup === 'Low' ? 2 : complexityGroup === 'Low-Med' ? 4 : 
                                  complexityGroup === 'Med' ? 8 : complexityGroup === 'Med-High' ? 16 : 32;
            } else {
                // <$100M -> row 5 (index 4), col_4 = 4
                complexityScore = complexityGroup === 'Low' ? 1 : complexityGroup === 'Low-Med' ? 2 : 
                                  complexityGroup === 'Med' ? 4 : complexityGroup === 'Med-High' ? 8 : 16;
            }
            
            // ============================================
            // STEP 2: Determine PRA column from complexity score
            // ============================================
            // PRA Score ranges (row 16, index 15): 1, 2, 3-6, 7-12, 13-48, >48
            // Corresponding columns: col_1, col_2, col_3, col_4, col_5, col_6
            let praColumn = 'col_1';
            if (complexityScore > 48) praColumn = 'col_6';
            else if (complexityScore >= 13) praColumn = 'col_5';
            else if (complexityScore >= 7) praColumn = 'col_4';
            else if (complexityScore >= 3) praColumn = 'col_3';
            else if (complexityScore === 2) praColumn = 'col_2';
            else praColumn = 'col_1';
            
            // ============================================
            // STEP 3: Get MH from duration and PRA column intersection
            // ============================================
            // Duration rows start at index 22 (6 months) through index 45 (24 months)
            // Use the DIGITAL_DELIVERY_MATRIX for lookup
            const matrix = DIGITAL_DELIVERY_MATRIX;
            
            // Clamp duration to valid range (6-24 months)
            const clampedDuration = Math.max(6, Math.min(24, Math.round(durationMonths)));
            const durationIdx = matrix.durations.indexOf(clampedDuration);
            const actualDurationIdx = durationIdx >= 0 ? durationIdx : matrix.durations.length - 1;
            
            // Map PRA column to complexity score key in matrix
            const praToScoreKey = {
                'col_1': 1,
                'col_2': 2,
                'col_3': 4,   // 3-6 range -> score 4
                'col_4': 8,   // 7-12 range -> score 8
                'col_5': 16,  // 13-48 range -> score 16
                'col_6': 24   // >48 range -> score 24
            };
            const scoreKey = praToScoreKey[praColumn] || 4;
            
            // Get MH from matrix
            const mhValues = matrix.complexityScores[scoreKey];
            const mh = mhValues ? (mhValues[actualDurationIdx] || mhValues[mhValues.length - 1]) : 0;
            
            // ============================================
            // Calculate costs using $68/hr rate
            // ============================================
            const rawLabor = mh * hourlyRate;
            const burden = rawLabor * (burdenRate / 100);
            const gna = rawLabor * (gnaRate / 100);
            const margin = rawLabor * (marginPercent / 100);
            const revenue = rawLabor + burden + gna + margin;
            const totalCost = rawLabor + burden;
            
            return {
                mh: mh,
                complexityScore: complexityScore,
                praColumn: praColumn,
                durationMonths: clampedDuration,
                hourlyRate: hourlyRate,
                rawLabor: rawLabor,
                burden: burden,
                gna: gna,
                margin: margin,
                revenue: revenue,
                totalCost: totalCost
            };
        }

        /**
         * Calculate ESDC or TSCD based on project cost percentage
         * For ESDC/TSCD, the benchmark data shows REVENUE (esdc_cost), not hours
         * We need to calculate Revenue and back-calculate to hours
         * @param {string} disciplineId - 'esdc' or 'tscd'
         * @param {number} projectCostK - Project cost in thousands (K$)
         * @param {Array} selectedProjects - Optional specific projects for rate
         * @returns {Object} { mh: number, rate: number, revenue: number, rawLabor: number, burden: number, gna: number, margin: number }
         */
        function calculateServicesMH(disciplineId, projectCostK, selectedProjects = null) {
            const benchmarks = getBenchmarkDataSync(disciplineId);
            if (!benchmarks) return { mh: 0, rate: 0, revenue: 0, rawLabor: 0, burden: 0, gna: 0, margin: 0 };
            
            const projects = selectedProjects || getApplicableProjects(disciplineId);
            
            // For ESDC/TSCD, rate is a percentage (production_pct)
            // e.g., 1.19 means 1.19% of project cost
            const rate = projects.length > 0 
                ? calculateWeightedRate(projects, 'average') 
                : (benchmarks.customRate || 0.01); // Default to 1%
            
            // Revenue = Project Cost × (rate / 100) since rate is already in percentage form
            // But looking at the data, production_pct is already a percentage like 1.19 (meaning 1.19%)
            const revenueK = projectCostK * (rate / 100); // Rate is like 1.19 for 1.19%
            const revenue = revenueK * 1000; // Convert K$ to $
            
            // Get rates from the cost calculation parameters
            const burdenRate = parseFloat(document.getElementById('unified-burden')?.value) || 66;
            const gnaRate = parseFloat(document.getElementById('unified-gna')?.value) || 104;
            const kieMultiplier = parseFloat(document.getElementById('calc-kie-multiplier')?.value) || 2.85;
            
            // Calculate margin percent: KIE Multiplier - 1 - Burden Rate - G&A Rate
            const marginPercent = (kieMultiplier - 1 - (burdenRate / 100) - (gnaRate / 100)) * 100;
            
            // Back-calculate from Revenue:
            // Revenue = Raw Labor × KIE Multiplier (approximately)
            // More precisely: Revenue = Raw Labor + Burden + G&A + Margin
            // Where: Burden = Raw Labor × Burden%, G&A = Raw Labor × G&A%, Margin = Raw Labor × Margin%
            // So: Revenue = Raw Labor × (1 + Burden% + G&A% + Margin%) = Raw Labor × KIE Multiplier
            const rawLabor = revenue / kieMultiplier;
            const burden = rawLabor * (burdenRate / 100);
            const gna = rawLabor * (gnaRate / 100);
            const margin = rawLabor * (marginPercent / 100);
            
            // Get weighted hourly rate for this discipline (ESDC/TSCD use $64.50/hr)
            const weightedRate = ESDC_TSCD_HOURLY_RATE;
            
            // Calculate hours from Raw Labor
            const mh = Math.round(rawLabor / weightedRate);
            
            return {
                mh: mh,
                rate: rate,
                revenue: revenue,
                revenueK: revenueK,
                rawLabor: rawLabor,
                burden: burden,
                gna: gna,
                margin: margin,
                weightedRate: weightedRate,
                projects: projects
            };
        }

        /**
         * Calculate Misc Structures MH as percentage of Roadway + Drainage + Traffic
         * @param {number} roadwayMH - Roadway discipline MH
         * @param {number} drainageMH - Drainage discipline MH
         * @param {number} trafficMH - Traffic discipline MH
         * @param {Array} selectedProjects - Optional specific projects for rate
         * @returns {Object} { mh: number, rate: number, baseMH: number }
         */
        function calculateMiscStructuresMH(roadwayMH, drainageMH, trafficMH, selectedProjects = null) {
            const benchmarks = getBenchmarkDataSync('miscStructures');
            if (!benchmarks) return { mh: 0, rate: 0, baseMH: 0 };
            
            const baseMH = roadwayMH + drainageMH + trafficMH;
            const projects = selectedProjects || getApplicableProjects('miscStructures');
            const rate = projects.length > 0 ? calculateWeightedRate(projects) : benchmarks.customRate;
            
            // Calculate statistical bounds for the estimate
            let mhBounds = null;
            if (projects.length >= 2) {
                const rateStats = BenchmarkStats.calculateRateStats(projects);
                mhBounds = BenchmarkStats.estimateWithBounds(baseMH, rateStats);
            }
            
            return {
                mh: Math.round(baseMH * rate),
                rate: rate,
                baseMH: baseMH,
                projects: projects,
                mhBounds: mhBounds
            };
        }

        /**
         * Generate full MH estimate for all applicable disciplines
         * @param {Object} quantities - Object with disciplineId: quantity pairs
         * @param {Object} options - { projectCostK, durationMonths, complexity, projectType }
         * @returns {Object} Full estimate with per-discipline breakdown and totals
         */
        function generateFullMHEstimate(quantities, options = {}) {
            const { 
                projectCostK = 0, 
                durationMonths = 20, 
                complexity = 'Med',
                projectType = 'highway'
            } = options;
            
            const estimate = {
                disciplines: {},
                totalMH: 0,
                projectCostK: projectCostK,
                generatedAt: new Date().toISOString()
            };
            
            // Calculate standard benchmark disciplines
            const standardDisciplines = ['drainage', 'mot', 'roadway', 'traffic', 'utilities', 
                'retainingWalls', 'noiseWalls', 'bridgesPCGirder', 'bridgesSteel', 'bridgesRehab',
                'geotechnical', 'systems', 'track', 'environmental'];
            
            for (const discId of standardDisciplines) {
                const qty = quantities[discId] || 0;
                if (qty > 0) {
                    const result = estimateMH(discId, qty);
                    estimate.disciplines[discId] = {
                        ...result,
                        config: DISCIPLINE_CONFIG[discId]
                    };
                    estimate.totalMH += result.mh;
                }
            }
            
            // Calculate Digital Delivery
            if (projectCostK > 0) {
                const ddResult = calculateDigitalDeliveryMH(projectCostK, durationMonths, complexity);
                estimate.disciplines.digitalDelivery = {
                    ...ddResult,
                    config: DISCIPLINE_CONFIG.digitalDelivery,
                    quantity: projectCostK,
                    unit: 'K$'
                };
                estimate.totalMH += ddResult.mh;
            }
            
            // Calculate Misc Structures (after roadway, drainage, traffic are calculated)
            const roadwayMH = estimate.disciplines.roadway?.mh || 0;
            const drainageMH = estimate.disciplines.drainage?.mh || 0;
            const trafficMH = estimate.disciplines.traffic?.mh || 0;
            
            if (roadwayMH + drainageMH + trafficMH > 0) {
                const msResult = calculateMiscStructuresMH(roadwayMH, drainageMH, trafficMH);
                estimate.disciplines.miscStructures = {
                    ...msResult,
                    config: DISCIPLINE_CONFIG.miscStructures,
                    quantity: msResult.baseMH,
                    unit: 'MHR'
                };
                estimate.totalMH += msResult.mh;
            }
            
            // Calculate ESDC and TSCD
            if (projectCostK > 0) {
                const esdcResult = calculateServicesMH('esdc', projectCostK);
                estimate.disciplines.esdc = {
                    ...esdcResult,
                    config: DISCIPLINE_CONFIG.esdc,
                    quantity: projectCostK,
                    unit: 'K$'
                };
                estimate.totalMH += esdcResult.mh;
                
                const tscdResult = calculateServicesMH('tscd', projectCostK);
                estimate.disciplines.tscd = {
                    ...tscdResult,
                    config: DISCIPLINE_CONFIG.tscd,
                    quantity: projectCostK,
                    unit: 'K$'
                };
                estimate.totalMH += tscdResult.mh;
            }
            
            return estimate;
        }

        /**
         * Format MH number with thousands separator
         * @param {number} mh - Man-hours value
         * @returns {string} Formatted string
         */
        function formatMH(mh) {
            return mh.toLocaleString('en-US', { maximumFractionDigits: 0 });
        }

        /**
         * Format production rate based on discipline unit
         * @param {number} rate - Production rate
         * @param {string} unit - Unit of measure
         * @returns {string} Formatted rate string
         */
        function formatRate(rate, unit) {
            if (unit === 'K$' || unit === 'MHR') {
                return (rate * 100).toFixed(2) + '%';
            }
            return rate.toFixed(3);
        }

        // ============================================
        // MH ESTIMATOR UI FUNCTIONS
        // ============================================

        /**
         * Handle benchmark dataset change (Highway/Bridge Projects vs Wall Projects)
         */
        async function handleBenchmarkDatasetChange() {
            const select = document.getElementById('benchmark-dataset');
            if (!select) return;

            const newDataset = select.value;
            activeBenchmarkDataset = newDataset;

            // Update the active mapping
            if (newDataset === 'border-wall') {
                BENCHMARK_FILE_MAPPING = { ...BENCHMARK_FILE_MAPPING_BORDER_WALL };
            } else {
                BENCHMARK_FILE_MAPPING = { ...BENCHMARK_FILE_MAPPING_HIGHWAY_BRIDGE };
            }

            // Clear the cache to force reload of new dataset
            benchmarkDataCache = {};
            benchmarkDataLoaded = false;
            benchmarkLoadPromise = null;

            // Show loading status
            updateStatus('LOADING BENCHMARKS...');

            // Reload benchmark data from new dataset
            try {
                await loadBenchmarkData();
                console.log(`Benchmark data loaded from: ${newDataset === 'border-wall' ? 'Wall Projects' : 'Highway/Bridge Projects'}`);
            } catch (error) {
                console.warn('Failed to load benchmark data:', error);
            }

            // Reinitialize the unified table with all projects selected
            initUnifiedEstimator();

            updateStatus('READY');

            alert(`✅ Benchmark dataset changed to: ${newDataset === 'border-wall' ? 'Wall Projects' : 'Highway/Bridge Projects'}\n\nAll projects are now selected by default.`);
        }

        /**
         * Select all benchmark projects for all disciplines
         */
        function selectAllBenchmarks() {
            let updated = 0;

            // Loop through all disciplines (ESDC/TSCD excluded: selection comes from Applicable? = Yes only)
            for (const discId of Object.keys(mhEstimateState.disciplines)) {
                if (discId === 'esdc' || discId === 'tscd') continue;

                const state = mhEstimateState.disciplines[discId];
                if (!state.active) continue;

                // Get all available projects for this discipline
                const benchmarks = getBenchmarkDataSync(discId);
                if (!benchmarks || !benchmarks.projects) continue;

                // Force all projects to be applicable (for modal checkboxes)
                benchmarks.projects.forEach(project => {
                    project.applicable = true;
                });

                // Set all projects as selected
                state.selectedProjects = [...benchmarks.projects];

                // Recalculate MH with all projects
                if (state.quantity > 0) {
                    const result = estimateMH(discId, state.quantity, state.selectedProjects);
                    state.mh = result.mh;
                    state.rate = result.rate;
                    if (result.allRate != null) state.allRate = result.allRate;

                    // Update display
                    const mhElem = document.getElementById(`unified-mh-${discId}`);
                    if (mhElem) mhElem.textContent = formatMH(result.mh);
                    const config = DISCIPLINE_CONFIG[discId];
                    const benchmarks = getBenchmarkDataSync(discId);
                    const unit = config?.unit || benchmarks?.eqty_metric?.uom || 'EA';
                    const rateElem = document.getElementById(`unified-rate-${discId}`);
                    if (rateElem) rateElem.textContent = formatRate(result.rate, unit);
                    const allRateEl = document.getElementById(`unified-rate-all-${discId}`);
                    if (discId !== 'esdc' && discId !== 'tscd' && allRateEl && result.allRate != null) allRateEl.textContent = formatRate(result.allRate, unit);
                    if (discId === 'esdc' || discId === 'tscd') { if (allRateEl) allRateEl.textContent = '—'; }
                    const wideOpenEl = document.getElementById(`unified-wide-open-mh-${discId}`);
                    const customMHEl = document.getElementById(`unified-custom-mh-${discId}`);
                    const wideOpenRate = (discId === 'esdc' || discId === 'tscd') ? result.rate : (state.allRate != null ? state.allRate : result.allRate || 0);
                    if (wideOpenEl) wideOpenEl.textContent = formatMH(Math.round(state.quantity * wideOpenRate));
                    if (customMHEl) customMHEl.textContent = formatMH(result.mh);

                    // Recalculate costs
                    recalculateUnifiedCosts(discId);
                    updated++;
                }
            }

            // Update summary
            updateUnifiedSummary();
            saveToLocalStorage();

            alert(`✅ All benchmark projects selected!\n\n${updated} discipline(s) updated with all available projects.\n\n"All Rate" and "Selected Rate" should now match.`);
        }

        /**
         * Toggle MH Estimator panel visibility
         */
        function toggleMHEstimator() {
            const body = document.getElementById('mh-estimator-body');
            const header = document.querySelector('.mh-estimator-header h3');
            
            if (body.classList.contains('collapsed')) {
                body.classList.remove('collapsed');
                header.innerHTML = '⚡ MH BENCHMARK ESTIMATOR';
            } else {
                body.classList.add('collapsed');
                header.innerHTML = '► MH BENCHMARK ESTIMATOR';
            }
        }

        /**
         * Initialize MH Estimator table with all disciplines
         */
        function initMHEstimator() {
            const tbody = document.getElementById('mh-estimate-tbody');
            if (!tbody) return;
            
            tbody.innerHTML = '';
            
            // Define display order for disciplines
            const disciplineOrder = [
                'roadway', 'drainage', 'mot', 'traffic', 'utilities',
                'retainingWalls', 'noiseWalls', 
                'bridgesPCGirder', 'bridgesSteel', 'bridgesRehab',
                'miscStructures', 'geotechnical',
                'systems', 'track', 'environmental',
                'digitalDelivery'
            ];
            
            for (const discId of disciplineOrder) {
                const config = DISCIPLINE_CONFIG[discId];
                if (!config) continue;
                
                const benchmarks = getBenchmarkDataSync(discId);
                const defaultRate = benchmarks ? (benchmarks.customRate || benchmarks.defaultRate) : 0;
                
                // Initialize state
                mhEstimateState.disciplines[discId] = {
                    active: true,
                    quantity: 0,
                    rate: defaultRate,
                    mh: 0,
                    l4Percentage: 30  // Default 30% of MH above L4 Engg
                };
                
                const row = document.createElement('tr');
                row.id = `mh-row-${discId}`;
                row.className = '';
                
                // Calculate "all projects" rate for tooltip
                const allProjects = benchmarks ? benchmarks.projects || [] : [];
                const allProjectsRate = allProjects.length > 0 ? BenchmarkStats.calculateRateStats(allProjects).mean : 0;

                // Get resource rates for this discipline
                const resources = getDisciplineResources(config.name);
                
                row.innerHTML = `
                    <td>
                        <div class="discipline-name">
                            <span>${config.name}</span>
                        </div>
                    </td>
                    <td><span class="discipline-code">${config.accountCode || '—'}</span></td>
                    <td class="numeric">
                        <div class="qty-input-wrapper">
                            <input type="text" class="qty-input" id="mh-qty-${discId}"
                                   value="0" inputmode="numeric"
                                   onchange="updateMHQuantity('${discId}')"
                                   onblur="updateMHQuantity('${discId}')">
                            <span class="qty-source-indicator" id="mh-qty-source-${discId}" style="display: none;" title=""></span>
                        </div>
                    </td>
                    <td>${config.unit}</td>
                    <td class="benchmark-select-cell">
                        <button class="btn-benchmark-select" onclick="showDisciplineBenchmark('${discId}')" title="Select benchmark projects for ${config.name}">
                            <span class="benchmark-icon">📊</span>
                            <span class="benchmark-btn-text">Select</span>
                        </button>
                    </td>
                    <td class="numeric">
                        <span class="rate-display rate-all-projects" id="mh-rate-all-${discId}" title="${buildAllProjectsRateTooltip(discId, allProjectsRate, allProjects.length, config.unit)}">${formatRate(allProjectsRate, config.unit)}</span>
                    </td>
                    <td class="numeric">
                        <span class="rate-display rate-selected" id="mh-rate-${discId}" title="${buildSelectedRateTooltip(discId, defaultRate, 0, config.unit)}">${formatRate(defaultRate, config.unit)}</span>
                    </td>
                    <td class="numeric">
                        <span class="mh-value" id="mh-value-${discId}">0</span>
                        <div class="mh-range" id="mh-range-${discId}" style="font-size: 9px; color: #888; margin-top: 2px; display: none;"></div>
                    </td>
                    <td class="numeric">
                        <div class="l4-input-wrapper">
                            <input type="number" class="l4-input" id="mh-l4-pct-${discId}" 
                                   value="30" min="0" max="100" step="5"
                                   onchange="updateL4Percentage('${discId}')"
                                   title="% MH allocated to Level 4+ Engineers">
                            <span class="l4-pct-symbol">%</span>
                        </div>
                    </td>
                    <td>
                        <span class="projects-used" id="mh-projects-${discId}" title="Click to expand">—</span>
                    </td>
                `;
                
                tbody.appendChild(row);
            }
        }

        /**
         * Toggle a discipline on/off in the estimate
         */
        function toggleMHDiscipline(discId) {
            const state = mhEstimateState.disciplines[discId];
            const row = document.getElementById(`mh-row-${discId}`);
            const toggle = row.querySelector('.discipline-toggle');
            const qtyInput = document.getElementById(`mh-qty-${discId}`);
            
            state.active = !state.active;
            
            if (state.active) {
                row.classList.remove('discipline-row-inactive');
                if (toggle) {
                    toggle.classList.add('active');
                    toggle.textContent = '✓';
                }
                qtyInput.disabled = false;
                qtyInput.focus();
            } else {
                row.classList.add('discipline-row-inactive');
                if (toggle) {
                    toggle.classList.remove('active');
                    toggle.textContent = '+';
                }
                qtyInput.disabled = true;
                state.quantity = 0;
                state.mh = 0;
                qtyInput.value = '0';
                document.getElementById(`mh-value-${discId}`).textContent = '0';
                document.getElementById(`mh-projects-${discId}`).textContent = '—';
            }
            
            recalculateTotalMH();
        }

        /**
         * Update project cost and recalculate special disciplines
         */
        function updateMHProjectCost() {
            const input = document.getElementById('mh-project-cost');
            const value = parseFloat(input.value.replace(/[,$]/g, '')) || 0;
            mhEstimateState.projectCost = value;
            
            // Format the input with commas
            if (value > 0) {
                input.value = value.toLocaleString('en-US');
            }
            
            // Auto-activate and calculate Digital Delivery, ESDC, TSCD if cost entered
            if (value > 0) {
                const costK = value / 1000;
                
                // Digital Delivery
                const ddState = mhEstimateState.disciplines.digitalDelivery;
                if (ddState) {
                    ddState.active = true;
                    ddState.quantity = costK;
                    const ddResult = calculateDigitalDeliveryMH(
                        costK, 
                        parseInt(document.getElementById('mh-design-duration').value) || 20,
                        document.getElementById('mh-complexity').value || 'Med'
                    );
                    ddState.mh = ddResult.mh;
                    ddState.rate = ddResult.mh / costK;
                    updateMHRowDisplay('digitalDelivery', ddState);
                }
                
                // ESDC - Revenue-based calculation
                const esdcState = mhEstimateState.disciplines.esdc;
                const esdcBenchmarks = getBenchmarkDataSync('esdc');
                if (esdcState) {
                    esdcState.active = true;
                    esdcState.quantity = costK;
                    const esdcResult = calculateServicesMH('esdc', costK);
                    // Store all the revenue breakdown values
                    esdcState.mh = esdcResult.mh;
                    esdcState.revenue = esdcResult.revenue;
                    esdcState.rawLabor = esdcResult.rawLabor;
                    esdcState.burden = esdcResult.burden;
                    esdcState.gna = esdcResult.gna;
                    esdcState.margin = esdcResult.margin;
                    esdcState.rate = esdcResult.rate;
                    updateMHRowDisplay('esdc', esdcState);
                }
                
                // TSCD - Revenue-based calculation
                const tscdState = mhEstimateState.disciplines.tscd;
                const tscdBenchmarks = getBenchmarkDataSync('tscd');
                if (tscdState) {
                    tscdState.active = true;
                    tscdState.quantity = costK;
                    const tscdResult = calculateServicesMH('tscd', costK);
                    // Store all the revenue breakdown values
                    tscdState.mh = tscdResult.mh;
                    tscdState.revenue = tscdResult.revenue;
                    tscdState.rawLabor = tscdResult.rawLabor;
                    tscdState.burden = tscdResult.burden;
                    tscdState.gna = tscdResult.gna;
                    tscdState.margin = tscdResult.margin;
                    tscdState.rate = tscdResult.rate;
                    updateMHRowDisplay('tscd', tscdState);
                }
            }
            
            recalculateTotalMH();
        }

        /**
         * Update display for a single discipline row
         */
        function updateMHRowDisplay(discId, state) {
            const row = document.getElementById(`mh-row-${discId}`);
            if (!row) {
                console.warn(`updateMHRowDisplay: Row not found for discipline ${discId}`);
                return;
            }
            const toggle = row.querySelector('.discipline-toggle');
            const qtyInput = document.getElementById(`mh-qty-${discId}`);
            const config = DISCIPLINE_CONFIG[discId];
            const benchmarks = getBenchmarkDataSync(discId);
            const unit = config?.unit || benchmarks?.eqty_metric?.uom || 'EA';

            if (state.active) {
                row.classList.remove('discipline-row-inactive');
                if (toggle) {
                    toggle.classList.add('active');
                    toggle.textContent = '✓';
                }
                qtyInput.disabled = false;
            }

            qtyInput.value = state.quantity.toLocaleString('en-US');

            // Update "All Projects" rate column: curve at quantity (same basis as benchmark chart)
            const allProjects = benchmarks ? benchmarks.projects || [] : [];
            const allProjectsMean = allProjects.length > 0 ? BenchmarkStats.calculateRateStats(allProjects).mean : 0;
            const qtyNum = Number(state.quantity) || 0;
            let allProjectsRate = allProjectsMean;
            if (discId !== 'esdc' && discId !== 'tscd' && qtyNum > 0 && allProjects.length >= 2) {
                const curveRate = getRateFromAllProjectsCurve(discId, qtyNum);
                if (curveRate != null) allProjectsRate = curveRate;
            } else if (state.allRate != null && qtyNum > 0) {
                allProjectsRate = state.allRate;
            }
            const rateAllEl = document.getElementById(`mh-rate-all-${discId}`);
            if (rateAllEl) {
                // ESDC/TSCD: Show rate as percentage of project cost
                if (discId === 'esdc' || discId === 'tscd') {
                    rateAllEl.textContent = `${allProjectsRate.toFixed(2)}%`;
                    rateAllEl.title = `Avg: ${allProjectsRate.toFixed(2)}% of Project Cost (${allProjects.length} projects)`;
                } else {
                    rateAllEl.textContent = formatRate(allProjectsRate, unit);
                    const curveNote = (state.quantity > 0 && allProjects.length >= 2) ? ' (curve at qty)' : '';
                    rateAllEl.title = buildAllProjectsRateTooltip(discId, allProjectsRate, allProjects.length, unit) + curveNote;
                }
            }

            // Update "Selected Projects" rate column
            const applicableProjects = getApplicableProjects(discId);
            const selectedRateEl = document.getElementById(`mh-rate-${discId}`);
            if (selectedRateEl) {
                // ESDC/TSCD: Show rate as percentage of project cost
                if (discId === 'esdc' || discId === 'tscd') {
                    selectedRateEl.textContent = `${state.rate.toFixed(2)}%`;
                    selectedRateEl.title = `Selected: ${state.rate.toFixed(2)}% of Project Cost (${applicableProjects.length} projects)`;
                } else {
                    selectedRateEl.textContent = formatRate(state.rate, unit);
                    selectedRateEl.title = buildSelectedRateTooltip(discId, state.rate, applicableProjects.length, unit, state.rateStats);
                }
            }

            // Update quantity input tooltip with RFP reasoning if available
            const qtySourceEl = document.getElementById(`mh-qty-source-${discId}`);
            if (qtySourceEl && state.rfpReasoning) {
                qtySourceEl.style.display = 'inline';
                qtySourceEl.textContent = 'RFP';
                qtySourceEl.title = buildQuantityReasoningTooltip(discId, state.quantity, state.rfpReasoning);
                qtySourceEl.className = 'qty-source-indicator rfp-source';
                qtyInput.title = buildQuantityReasoningTooltip(discId, state.quantity, state.rfpReasoning);
            } else if (qtySourceEl) {
                qtySourceEl.style.display = 'none';
                qtyInput.title = '';
            }

            // Display MH with statistical range if available
            const mhValueEl = document.getElementById(`mh-value-${discId}`);
            const mhRangeEl = document.getElementById(`mh-range-${discId}`);

            // ESDC/TSCD: MH is back-calculated from revenue
            if (discId === 'esdc' || discId === 'tscd') {
                mhValueEl.textContent = formatMH(state.mh);
                mhValueEl.title = `Back-calculated from Revenue ($${(state.revenue || 0).toLocaleString()})`;
                mhValueEl.style.cursor = 'help';
                if (mhRangeEl) {
                    mhRangeEl.style.display = 'block';
                    mhRangeEl.innerHTML = `<span style="font-size: 9px; color: #ffd700;">← from Revenue</span>`;
                    mhRangeEl.title = 'Hours derived from Revenue ÷ KIE Multiplier ÷ Weighted Rate';
                }
            } else if (state.mhBounds && state.mhBounds.lower !== state.mhBounds.upper && state.mh > 0) {
                // Show estimate with visible range below
                mhValueEl.textContent = formatMH(state.mh);
                mhValueEl.title = `Best estimate based on avg rate`;
                mhValueEl.style.cursor = 'help';

                // Show range directly in the UI
                if (mhRangeEl) {
                    mhRangeEl.style.display = 'block';
                    mhRangeEl.innerHTML = `<span style="color: #4da6ff;">±</span> ${formatMH(state.mhBounds.lower)} - ${formatMH(state.mhBounds.upper)}`;
                    mhRangeEl.title = 'Range based on avg ± std dev of historical project rates';
                }
            } else {
                mhValueEl.textContent = formatMH(state.mh);
                mhValueEl.title = '';
                if (mhRangeEl) {
                    mhRangeEl.style.display = 'none';
                }
            }

            // Show projects used with statistical info
            if (benchmarks) {
                const projectNames = applicableProjects.slice(0, 3).map(p => p.name.split(' ')[0]).join(', ');
                const suffix = applicableProjects.length > 3 ? ` +${applicableProjects.length - 3}` : '';
                const projectsEl = document.getElementById(`mh-projects-${discId}`);
                projectsEl.textContent = projectNames + suffix || '—';

                // Add tooltip showing rate statistics if available
                if (state.rateStats && state.rateStats.stdDev > 0) {
                    projectsEl.title = `Rate: ${state.rateStats.mean.toFixed(3)} ± ${state.rateStats.stdDev.toFixed(3)} ${config.unit}/MH (${applicableProjects.length} projects)`;
                }
            }
            
            // Calculate and display Low/High estimates using discipline resource rates
            // L4 percentage determines the split:
            // - Low Estimate: (100 - L4%) of MH × Low Rate (junior portion)
            // - High Estimate: L4% of MH × High Rate (senior portion)
            const resources = getDisciplineResources(config.name);
            const l4Pct = state.l4Percentage !== undefined ? state.l4Percentage : 30;
            const lowPct = (100 - l4Pct) / 100;  // Percentage at low (junior) rate
            const highPct = l4Pct / 100;         // Percentage at high (senior) rate
            
            let totalEstimate;
            
            // ESDC/TSCD: Use raw labor from revenue back-calculation
            if ((discId === 'esdc' || discId === 'tscd') && state.rawLabor > 0) {
                totalEstimate = state.rawLabor;
            } else {
                // Standard: Calculate from MH × rates
                // Low Estimate: junior portion (100 - L4%) × MH × Low Rate
                const lowEstimate = state.mh * lowPct * resources.lowRate;
                // High Estimate: senior portion L4% × MH × High Rate
                const highEstimate = state.mh * highPct * resources.highRate;
                totalEstimate = lowEstimate + highEstimate;
            }
            
            // Update L4 input value in case it was set programmatically
            const l4Input = document.getElementById(`mh-l4-pct-${discId}`);
            if (l4Input && l4Input.value != l4Pct) {
                l4Input.value = l4Pct;
            }
            
            const formattedTotal = state.mh > 0 || ((discId === 'esdc' || discId === 'tscd') && state.rawLabor > 0)
                ? Math.round(totalEstimate).toLocaleString('en-US')
                : '0';
            const costInput = document.querySelector(`.budget-input[data-disc="${config.name}"]`);
            if (costInput) {
                costInput.value = formattedTotal;
                projectData.budgets[config.name] = parseFloat(formattedTotal.replace(/,/g, '')) || 0;
                updateTotalBudget();
            }
        }

        /**
         * Update quantity for a discipline and recalculate MH
         */
        function updateMHQuantity(discId) {
            const input = document.getElementById(`mh-qty-${discId}`);
            if (!input) return;

            const value = parseFloat(input.value.replace(/[,$]/g, '')) || 0;
            const state = mhEstimateState.disciplines[discId];
            if (!state) return;

            const config = DISCIPLINE_CONFIG[discId];
            const benchmarks = getBenchmarkDataSync(discId);
            const calculationType = config?.calculationType || (benchmarks ? 'benchmark' : null);

            state.quantity = value;

            // Format input with commas
            if (value > 0) {
                input.value = value.toLocaleString('en-US');
            }

            // Calculate MH based on discipline type
            if (calculationType === 'percentage' && discId === 'miscStructures') {
                // Misc Structures needs roadway + drainage + traffic MH
                const rdwyMH = mhEstimateState.disciplines.roadway?.mh || 0;
                const drnMH = mhEstimateState.disciplines.drainage?.mh || 0;
                const trfMH = mhEstimateState.disciplines.traffic?.mh || 0;
                const result = calculateMiscStructuresMH(rdwyMH, drnMH, trfMH);
                state.mh = result.mh;
                state.rate = result.rate;
            } else if (calculationType === 'benchmark') {
                const result = estimateMH(discId, value);
                state.mh = result.mh;
                state.rate = result.rate;
                if (result.allRate != null) state.allRate = result.allRate;
                // Force All Rate cell to curve value when quantity > 0 (so it always updates)
                if (value > 0 && discId !== 'esdc' && discId !== 'tscd' && benchmarks?.projects?.length >= 2) {
                    const curveRate = getRateFromAllProjectsCurve(discId, value);
                    if (curveRate != null && curveRate > 0) {
                        state.allRate = curveRate;
                        const rateAllEl = document.getElementById(`mh-rate-all-${discId}`);
                        const unit = config?.unit || benchmarks?.eqty_metric?.uom || 'EA';
                        if (rateAllEl) {
                            rateAllEl.textContent = formatRate(curveRate, unit);
                            rateAllEl.title = buildAllProjectsRateTooltip(discId, curveRate, benchmarks.projects.length, unit) + ' (curve at qty)';
                        }
                    }
                }
            }

            updateMHRowDisplay(discId, state);
            recalculateTotalMH();
        }

        /**
         * Update inputs (duration, type, complexity) and recalculate
         */
        function updateMHInputs() {
            mhEstimateState.designDuration = parseInt(document.getElementById('mh-design-duration').value) || 20;
            mhEstimateState.complexity = document.getElementById('mh-complexity').value || 'Med';
            
            // Recalculate Digital Delivery if active
            const ddState = mhEstimateState.disciplines.digitalDelivery;
            if (ddState && ddState.active && mhEstimateState.projectCost > 0) {
                const costK = mhEstimateState.projectCost / 1000;
                const ddResult = calculateDigitalDeliveryMH(costK, mhEstimateState.designDuration, mhEstimateState.complexity);
                ddState.mh = ddResult.mh;
                ddState.rate = ddResult.mh / costK;
                updateMHRowDisplay('digitalDelivery', ddState);
                recalculateTotalMH();
            }
        }

        /**
         * Update L4 percentage for a discipline and recalculate estimates
         */
        function updateL4Percentage(discId) {
            const input = document.getElementById(`mh-l4-pct-${discId}`);
            const value = parseFloat(input.value) || 50;
            const state = mhEstimateState.disciplines[discId];
            
            // Clamp between 0 and 100
            state.l4Percentage = Math.max(0, Math.min(100, value));
            input.value = state.l4Percentage;
            
            // Recalculate the estimates
            updateMHRowDisplay(discId, state);
        }

        /**
         * Toggle cost breakdown dropdown visibility
         */
        function toggleCostDropdown(discId) {
            const dropdown = document.getElementById(`cost-dropdown-${discId}`);
            const toggle = dropdown?.previousElementSibling;
            
            // Close all other dropdowns first
            document.querySelectorAll('.cost-dropdown.open').forEach(d => {
                if (d.id !== `cost-dropdown-${discId}`) {
                    d.classList.remove('open');
                    d.previousElementSibling?.classList.remove('open');
                }
            });
            
            if (dropdown) {
                dropdown.classList.toggle('open');
                toggle?.classList.toggle('open');
            }
        }

        // Close dropdown when clicking outside
        document.addEventListener('click', function(e) {
            if (!e.target.closest('.cost-dropdown-wrapper')) {
                document.querySelectorAll('.cost-dropdown.open').forEach(d => {
                    d.classList.remove('open');
                    d.previousElementSibling?.classList.remove('open');
                });
            }
        });

        /**
         * Recalculate total MH from all active disciplines
         */
        function recalculateTotalMH() {
            let total = 0;
            
            for (const discId of Object.keys(mhEstimateState.disciplines)) {
                const state = mhEstimateState.disciplines[discId];
                if (state.active) {
                    total += state.mh || 0;
                }
            }
            
            // Recalculate Misc Structures if active
            const msState = mhEstimateState.disciplines.miscStructures;
            if (msState && msState.active) {
                const rdwyMH = mhEstimateState.disciplines.roadway?.mh || 0;
                const drnMH = mhEstimateState.disciplines.drainage?.mh || 0;
                const trfMH = mhEstimateState.disciplines.traffic?.mh || 0;
                const baseMH = rdwyMH + drnMH + trfMH;
                
                if (baseMH > 0) {
                    const result = calculateMiscStructuresMH(rdwyMH, drnMH, trfMH);
                    msState.mh = result.mh;
                    msState.quantity = baseMH;
                    msState.rate = result.rate;
                    updateMHRowDisplay('miscStructures', msState);
                }
            }
            
            // Calculate total range from all disciplines with bounds
            let totalLower = 0;
            let totalUpper = 0;
            let hasStatisticalData = false;
            
            for (const discId of Object.keys(mhEstimateState.disciplines)) {
                const state = mhEstimateState.disciplines[discId];
                if (state.active && state.mhBounds) {
                    totalLower += state.mhBounds.lower || state.mh || 0;
                    totalUpper += state.mhBounds.upper || state.mh || 0;
                    hasStatisticalData = true;
                } else if (state.active) {
                    totalLower += state.mh || 0;
                    totalUpper += state.mh || 0;
                }
            }
            
            const totalDisplayEl = document.getElementById('mh-total-display');
            const totalRangeEl = document.getElementById('mh-total-range');
            totalDisplayEl.textContent = formatMH(total);
            
            // Show range prominently if statistical data is available
            if (hasStatisticalData && totalLower !== totalUpper && total > 0) {
                totalDisplayEl.title = `Best estimate based on average rates`;
                totalDisplayEl.style.cursor = 'help';
                
                // Show range in dedicated element (more visible)
                if (totalRangeEl) {
                    totalRangeEl.style.display = 'block';
                    totalRangeEl.innerHTML = `📊 Confidence Range: <strong>${formatMH(totalLower)} - ${formatMH(totalUpper)}</strong> MH`;
                    totalRangeEl.title = 'Based on avg ± std dev of historical project rates';
                }
            } else {
                if (totalRangeEl) {
                    totalRangeEl.style.display = 'none';
                }
            }
            
            // Update status with range info
            const statusText = total > 0 
                ? (hasStatisticalData 
                    ? `${formatMH(total)} MH estimated (range: ${formatMH(totalLower)} - ${formatMH(totalUpper)})` 
                    : `${formatMH(total)} MH estimated`)
                : 'Configure project parameters';
            document.getElementById('mh-estimator-status').textContent = statusText;
        }

        /**
         * Reset MH estimate to initial state
         */
        function resetMHEstimate() {
            mhEstimateState.projectCost = 0;
            mhEstimateState.designDuration = 20;
            mhEstimateState.complexity = 'Med';
            
            document.getElementById('mh-project-cost').value = '';
            document.getElementById('mh-design-duration').value = '20';
            document.getElementById('mh-complexity').value = 'Med';
            
            // Reset all discipline states
            for (const discId of Object.keys(mhEstimateState.disciplines)) {
                const state = mhEstimateState.disciplines[discId];
                state.active = true;
                state.quantity = 0;
                state.mh = 0;
                
                const row = document.getElementById(`mh-row-${discId}`);
                if (row) {
                    row.classList.remove('discipline-row-inactive');
                    
                    const qtyInput = document.getElementById(`mh-qty-${discId}`);
                    qtyInput.value = '0';
                    qtyInput.disabled = false;
                    
                    document.getElementById(`mh-value-${discId}`).textContent = '0';
                    document.getElementById(`mh-projects-${discId}`).textContent = '—';
                }
            }
            
            recalculateTotalMH();
        }

        /**
         * Show benchmark project selection modal for a specific discipline
         * @param {string} discId - Discipline ID to show benchmarks for
         */
        function showDisciplineBenchmark(discId) {
            // Show modal for just this one discipline
            showBenchmarkSelection(discId);
        }

        /**
         * Show benchmark project selection modal
         * @param {string|null} singleDiscipline - If provided, only show this discipline
         */
        function showBenchmarkSelection(singleDiscipline = null) {
            // Get active disciplines, or just the single one if specified
            let activeDisciplines;
            if (singleDiscipline) {
                activeDisciplines = [singleDiscipline];
            } else {
                activeDisciplines = Object.entries(mhEstimateState.disciplines)
                    .filter(([_, state]) => state.active)
                    .map(([id, _]) => id);
            }
            
            // Set first active discipline for chart
            const firstDiscipline = activeDisciplines[0] || null;
            currentBenchmarkDiscipline = firstDiscipline;
            
            // Build discipline tabs for chart
            let disciplineTabs = '';
            if (activeDisciplines.length > 0) {
                disciplineTabs = activeDisciplines.map(discId => {
                    const config = DISCIPLINE_CONFIG[discId];
                    const benchmarks = getBenchmarkDataSync(discId);
                    const displayName = config?.name || benchmarks?.displayName || benchmarks?.discipline || discId;
                    const isActive = discId === firstDiscipline ? 'active' : '';
                    return `<button class="benchmark-tab ${isActive}" data-disc="${discId}" onclick="switchBenchmarkChartDiscipline('${discId}')">${displayName}</button>`;
                }).join('');
            }

            // Build modal content with side-by-side layout
            let singleConfig = singleDiscipline ? DISCIPLINE_CONFIG[singleDiscipline] : null;
            if (!singleConfig && singleDiscipline) {
                // For Wall projects, get config from benchmarks
                const benchmarks = getBenchmarkDataSync(singleDiscipline);
                if (benchmarks) {
                    singleConfig = {
                        name: benchmarks.displayName || benchmarks.discipline || singleDiscipline
                    };
                }
            }
            const headerTitle = singleConfig
                ? `📊 Select Benchmark Projects for ${singleConfig.name}`
                : '📊 Select Benchmark Projects';
            
            let html = `
                <div class="benchmark-modal-content">
                    <div class="benchmark-modal-header">
                        <h3>${headerTitle}</h3>
                        <p>Choose which historical projects to include in rate calculations</p>
                    </div>
                    
                    <div class="benchmark-modal-body">
                        <!-- LEFT SIDE: Project Selection -->
                        <div class="benchmark-modal-left">
                            <div class="benchmark-disciplines">
            `;
            
            if (activeDisciplines.length === 0) {
                html += `<p style="color: #888; padding: 20px;">No disciplines are active. Enable disciplines in the MH Estimator first.</p>`;
            } else {
                for (let i = 0; i < activeDisciplines.length; i++) {
                    const discId = activeDisciplines[i];
                    const benchmarks = getBenchmarkDataSync(discId);

                    if (!benchmarks || !benchmarks.projects) {
                        console.warn('No benchmarks or projects for:', discId);
                        continue;
                    }

                    // For Wall projects, use data from benchmarks; for standard, use DISCIPLINE_CONFIG
                    const config = DISCIPLINE_CONFIG[discId] || {
                        name: benchmarks.displayName || benchmarks.discipline || discId,
                        unit: benchmarks.eqty_metric?.uom || 'EA'
                    };
                    
                    // Only expand if there's exactly 1 discipline; otherwise keep all collapsed
                    const isExpanded = activeDisciplines.length === 1;
                    const hiddenClass = isExpanded ? '' : 'hidden';
                    const arrowSymbol = isExpanded ? '▼' : '▶';
                    
                    // Count projects marked as applicable
                    const selectedCount = benchmarks.projects.filter(p => p.applicable).length;

                    html += `
                        <div class="benchmark-discipline-section" id="benchmark-section-${discId}">
                            <div class="benchmark-discipline-header" onclick="toggleBenchmarkSection('${discId}')">
                                <span>${arrowSymbol} ${config.name}</span>
                                <span class="benchmark-count" id="benchmark-count-${discId}">${selectedCount}/${benchmarks.projects.length} selected</span>
                            </div>
                            <div class="benchmark-projects ${hiddenClass}" id="benchmark-projects-${discId}">
                    `;

                    for (const project of benchmarks.projects) {
                        // Ensure all projects have the applicable flag (should already be set during init)
                        const checked = project.applicable ? 'checked' : '';
                        
                        // ESDC/TSCD: Show revenue-based stats
                        let projectStats;
                        if (discId === 'esdc' || discId === 'tscd') {
                            const revenueK = project.esdc_cost || project.cost || 0;
                            const prodPct = project.production_pct || project.rate || 0;
                            projectStats = `$${revenueK.toLocaleString()}K Revenue | ${prodPct.toFixed(2)}% of Project Cost`;
                        } else {
                            projectStats = `${formatMH(project.mh || project.cost || 0)} MH | ${(project.quantity || project.projectCost || 0).toLocaleString()} ${config.unit} | Rate: ${formatRate(project.rate, config.unit)}`;
                        }
                        
                        html += `
                            <label class="benchmark-project-item">
                                <input type="checkbox" ${checked} onchange="toggleBenchmarkProject('${discId}', '${project.id}')">
                                <div class="benchmark-project-info">
                                    <span class="project-name">${project.name}</span>
                                    <span class="project-stats">${projectStats}</span>
                                </div>
                            </label>
                        `;
                    }
                    
                    html += `
                            </div>
                        </div>
                    `;
                }
            }
            
            html += `
                            </div>
                        </div>
                        
                        <!-- RIGHT SIDE: Regression Chart -->
                        <div class="benchmark-modal-right">
                            <div class="benchmark-chart-container">
                                <div class="benchmark-chart-header">
                                    <h4 id="benchmark-chart-title">📈 ${(singleDiscipline === 'esdc' || singleDiscipline === 'tscd') ? 'Revenue vs Project Cost' : 'Rate vs Quantity'}</h4>
                                    <div class="benchmark-chart-legend">
                                        <div class="legend-item" id="benchmark-legend-all">
                                            <span class="legend-dot all-projects"></span>
                                            <span class="legend-label">All Projects</span>
                                        </div>
                                        <div class="legend-item">
                                            <span class="legend-dot selected-projects"></span>
                                            <span class="legend-label">Selected Projects</span>
                                        </div>
                                    </div>
                                </div>
                                ${activeDisciplines.length > 1 ? `<div class="benchmark-tabs">${disciplineTabs}</div>` : ''}
                                <div class="benchmark-chart-canvas-wrapper">
                                    <canvas id="benchmark-chart-canvas"></canvas>
                                </div>
                                <div class="benchmark-chart-equations">
                                    <div class="benchmark-equation" id="benchmark-equation-all-wrap">
                                        <div class="equation-label">All Projects</div>
                                        <div class="equation-formula all-projects" id="benchmark-eq-all">—</div>
                                        <div class="equation-r2" id="benchmark-r2-all"></div>
                                    </div>
                                    <div class="benchmark-equation">
                                        <div class="equation-label">Selected Projects</div>
                                        <div class="equation-formula selected-projects" id="benchmark-eq-selected">—</div>
                                        <div class="equation-r2" id="benchmark-r2-selected"></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="benchmark-modal-actions">
                        <button class="btn btn-sm" onclick="closeBenchmarkModal()">Cancel</button>
                        <button class="btn-mh" onclick="applyBenchmarkSelection()">Apply Selection</button>
                    </div>
                </div>
            `;
            
            // Create and show modal
            let modal = document.getElementById('benchmark-modal');
            if (!modal) {
                modal = document.createElement('div');
                modal.id = 'benchmark-modal';
                modal.className = 'modal-base';
                modal.innerHTML = `<div class="modal-content benchmark-modal-wrapper">${html}</div>`;
                document.body.appendChild(modal);
            } else {
                modal.querySelector('.modal-content').innerHTML = html;
            }
            
            modal.classList.add('open');
            
            // Initialize chart after modal is visible
            if (firstDiscipline) {
                setTimeout(() => {
                    updateBenchmarkChart(firstDiscipline);
                }, 100);
            }
        }
        
        /**
         * Switch the benchmark chart to show a different discipline
         */
        function switchBenchmarkChartDiscipline(discId) {
            currentBenchmarkDiscipline = discId;
            
            // Update tab styles
            const tabs = document.querySelectorAll('.benchmark-tab');
            tabs.forEach(tab => {
                if (tab.dataset.disc === discId) {
                    tab.classList.add('active');
                } else {
                    tab.classList.remove('active');
                }
            });
            
            // Update chart
            updateBenchmarkChart(discId);
        }

        /**
         * Toggle benchmark section visibility
         */
        function toggleBenchmarkSection(discId) {
            const section = document.getElementById(`benchmark-projects-${discId}`);
            if (!section) return;

            const header = section.previousElementSibling;
            if (!header) return;

            const arrow = header.querySelector('span:first-child');
            if (!arrow) return;

            // Get discipline name from config or benchmarks
            const config = DISCIPLINE_CONFIG[discId];
            const benchmarks = getBenchmarkDataSync(discId);
            const disciplineName = config?.name || benchmarks?.displayName || benchmarks?.discipline || discId;

            if (section.classList.contains('hidden')) {
                section.classList.remove('hidden');
                arrow.textContent = `▼ ${disciplineName}`;
            } else {
                section.classList.add('hidden');
                arrow.textContent = `▶ ${disciplineName}`;
            }
        }

        /**
         * Toggle a specific benchmark project on/off
         */
        function toggleBenchmarkProject(discId, projectId) {
            const benchmarks = getBenchmarkDataSync(discId);
            if (!benchmarks) return;
            
            const project = benchmarks.projects.find(p => p.id === projectId);
            if (project) {
                project.applicable = !project.applicable;
                
                // Update count display
                const count = benchmarks.projects.filter(p => p.applicable).length;
                const countEl = document.getElementById(`benchmark-count-${discId}`);
                if (countEl) {
                    countEl.textContent = `${count}/${benchmarks.projects.length} selected`;
                }
                
                // Live update the chart if this discipline is currently displayed
                if (currentBenchmarkDiscipline === discId) {
                    updateBenchmarkChart(discId);
                }
            }
        }

        /**
         * Close benchmark modal
         */
        function closeBenchmarkModal() {
            const modal = document.getElementById('benchmark-modal');
            if (modal) {
                modal.classList.remove('open');
            }
        }

        /**
         * Define discipline groups that share selected rates
         * When a rate is selected for any discipline in a group, apply to all in the group
         */
        const SHARED_RATE_GROUPS = {
            bridges: ['bridgesPCGirder', 'bridgesSteel', 'bridgesRehab'],
            noiseWalls: ['noiseWalls']  // Can add more noise wall types if needed
        };

        /**
         * Get the group a discipline belongs to for rate sharing
         */
        function getSharedRateGroup(discId) {
            for (const [groupName, disciplines] of Object.entries(SHARED_RATE_GROUPS)) {
                if (disciplines.includes(discId)) {
                    return { name: groupName, disciplines };
                }
            }
            return null;
        }

        /**
         * Apply benchmark selection and recalculate
         */
        function applyBenchmarkSelection() {
            // Track rates for shared groups - first discipline in group sets the rate
            const groupRates = {};

            // First pass: calculate rates for each active discipline
            for (const [discId, state] of Object.entries(mhEstimateState.disciplines)) {
                if (state.active && state.quantity > 0) {
                    const config = DISCIPLINE_CONFIG[discId];
                    const benchmarks = getBenchmarkDataSync(discId);
                    const calculationType = config?.calculationType || (benchmarks ? 'benchmark' : null);

                    if (calculationType === 'benchmark') {
                        const applicableProjects = getApplicableProjects(discId);
                        const qty = state.quantity;
                        const selectedCurveRate = getRateFromSelectedProjectsCurve(discId, qty);
                        const allCurveRate = getRateFromAllProjectsCurve(discId, qty);
                        const fallbackRate = applicableProjects.length > 0 ? calculateWeightedRate(applicableProjects) : benchmarks?.customRate || 0;
                        const allMean = benchmarks?.projects?.length > 0 ? BenchmarkStats.calculateRateStats(benchmarks.projects).mean : fallbackRate;

                        let rate = (selectedCurveRate != null && selectedCurveRate > 0) ? selectedCurveRate : fallbackRate;
                        let allRate = (allCurveRate != null && allCurveRate > 0) ? allCurveRate : allMean;

                        // Check if this discipline is part of a shared rate group
                        const group = getSharedRateGroup(discId);
                        if (group) {
                            // If group rate already set, use it; otherwise set it
                            if (groupRates[group.name]) {
                                rate = groupRates[group.name].rate;
                                allRate = groupRates[group.name].allRate;
                            } else {
                                groupRates[group.name] = { rate, allRate };
                            }
                        }

                        state.rate = rate;
                        state.allRate = allRate;
                        state.mh = Math.round(qty * state.rate);
                        state.selectedProjects = applicableProjects;

                        // Store statistical bounds if available
                        if (applicableProjects.length >= 2) {
                            const rateStats = BenchmarkStats.calculateRateStats(applicableProjects);
                            state.rateStats = rateStats;
                            state.mhBounds = BenchmarkStats.estimateWithBounds(state.quantity, rateStats);
                        }

                        updateMHRowDisplay(discId, state);

                        // Update unified table row if it exists
                        const unifiedMhElem = document.getElementById(`unified-mh-${discId}`);
                        const unifiedRateElem = document.getElementById(`unified-rate-${discId}`);
                        const unifiedRateAllElem = document.getElementById(`unified-rate-all-${discId}`);
                        const unit = config?.unit || benchmarks?.eqty_metric?.uom || 'EA';

                        if (unifiedMhElem) {
                            unifiedMhElem.textContent = formatMH(state.mh);
                        }
                        if (unifiedRateElem) {
                            unifiedRateElem.textContent = formatRate(state.rate, unit);
                        }
                        if (unifiedRateAllElem) {
                            if (discId === 'esdc' || discId === 'tscd') unifiedRateAllElem.textContent = '—';
                            else if (state.allRate != null) unifiedRateAllElem.textContent = formatRate(state.allRate, unit);
                        }
                        const wideOpenRate = (discId === 'esdc' || discId === 'tscd') ? state.rate : (state.allRate != null ? state.allRate : allMean);
                        const wideOpenMH = Math.round(qty * wideOpenRate);
                        const customMH = state.mh;
                        const unifiedWideOpenEl = document.getElementById(`unified-wide-open-mh-${discId}`);
                        const unifiedCustomMHEl = document.getElementById(`unified-custom-mh-${discId}`);
                        if (unifiedWideOpenEl) unifiedWideOpenEl.textContent = formatMH(wideOpenMH);
                        if (unifiedCustomMHEl) unifiedCustomMHEl.textContent = formatMH(customMH);

                        // Recalculate costs for unified table
                        if (typeof recalculateUnifiedCosts === 'function') {
                            recalculateUnifiedCosts(discId);
                        }
                    }
                }
            }

            // Second pass: Apply shared rates to disciplines with quantity 0 (inactive but in group)
            for (const [groupName, groupData] of Object.entries(groupRates)) {
                const group = SHARED_RATE_GROUPS[groupName];
                for (const discId of group) {
                    const state = mhEstimateState.disciplines[discId];
                    if (state && state.quantity === 0) {
                        // Store the shared rate even for inactive disciplines
                        state.rate = groupData.rate;
                        state.allRate = groupData.allRate;
                        
                        // Update rate display even for 0 quantity
                        const config = DISCIPLINE_CONFIG[discId];
                        const benchmarks = getBenchmarkDataSync(discId);
                        const unit = config?.unit || benchmarks?.eqty_metric?.uom || 'EA';
                        const unifiedRateElem = document.getElementById(`unified-rate-${discId}`);
                        if (unifiedRateElem) {
                            unifiedRateElem.textContent = formatRate(state.rate, unit);
                        }
                    }
                }
            }

            recalculateTotalMH();

            // Update unified summary
            if (typeof updateUnifiedSummary === 'function') {
                updateUnifiedSummary();
            }

            closeBenchmarkModal();

            // Show confirmation
            const updatedCount = Object.values(mhEstimateState.disciplines).filter(d => d.active).length;
            document.getElementById('mh-estimator-status').textContent = `Benchmarks updated for ${updatedCount} disciplines`;
        }

        /**
         * Apply MH estimate to budget table
         */
        function applyMHEstimate() {
            // Convert MH to dollars using an assumed hourly rate
            const hourlyRate = 150; // Default $150/hr - could be configurable
            
            let totalBudget = 0;
            
            for (const discId of Object.keys(mhEstimateState.disciplines)) {
                const state = mhEstimateState.disciplines[discId];
                if (state.active && state.mh > 0) {
                    const budget = state.mh * hourlyRate;
                    totalBudget += budget;
                    
                    // Map MH discipline to WBS discipline
                    const wbsName = mapMHDisciplineToWBS(discId);
                    if (wbsName && projectData.budgets[wbsName] !== undefined) {
                        projectData.budgets[wbsName] = budget;
                    }
                }
            }
            
            // Update calculator state
            projectData.calculator.totalDesignFee = totalBudget;
            projectData.calculator.isCalculated = true;
            
            // Update budget table display
            updateBudgetTable();
            
            // Update status
            const totalMH = Object.values(mhEstimateState.disciplines).reduce((sum, d) => sum + (d.active ? d.mh : 0), 0);
            document.getElementById('mh-estimator-status').textContent = `Applied ${formatMH(totalMH)} MH`;
            document.getElementById('calculator-status').textContent = `Applied MH estimate: ${formatCurrency(totalBudget)}`;
            
            alert(`✅ MH Estimate Applied!\n\nTotal MH: ${formatMH(totalMH)}\nTotal Budget: ${formatCurrency(totalBudget)}\n\n(Using $150/hr rate)`);
        }

        /**
         * Map MH discipline ID to WBS discipline name
         */
        function mapMHDisciplineToWBS(discId) {
            const mapping = {
                'roadway': 'Roadway',
                'drainage': 'Drainage',
                'mot': 'MOT',
                'traffic': 'Traffic',
                'utilities': 'Utilities',
                'retainingWalls': 'Structures',
                'noiseWalls': 'Structures',
                'bridgesPCGirder': 'Bridges',
                'bridgesSteel': 'Bridges',
                'bridgesRehab': 'Bridges',
                'miscStructures': 'Structures',
                'geotechnical': 'Geotechnical',
                'systems': 'Systems',
                'track': 'Track',
                'environmental': 'Environmental',
                'digitalDelivery': 'Digital Delivery',
                'esdc': 'ESDC',
                'tscd': 'TSCD'
            };
            return mapping[discId] || null;
        }

        // ============================================
        // UNIFIED MH & COST TABLE
        // ============================================

        /**
         * Initialize Unified Estimator Table
         */
        function initUnifiedEstimator() {
            const tbody = document.getElementById('unified-estimate-tbody');
            if (!tbody) return;

            tbody.innerHTML = '';

            // Ensure DIRECTS section is expanded when reinitializing
            tbody.classList.remove('hidden');
            const directsIcon = document.getElementById('directs-toggle-icon');
            if (directsIcon) {
                directsIcon.textContent = '▼';
            }

            // Determine which disciplines to display based on active dataset
            let disciplineOrder;
            if (activeBenchmarkDataset === 'border-wall') {
                // Wall Projects: use disciplines from loaded benchmark data
                disciplineOrder = Object.keys(benchmarkDataCache);
                console.log('Loading Wall disciplines:', disciplineOrder);
            } else {
                // Highway/Bridge Projects: standard disciplines; ESDC/TSCD appear only below (main cost table with chart icon), not under Labor/Directs
                disciplineOrder = [
                    'roadway', 'drainage', 'mot', 'traffic', 'utilities',
                    'retainingWalls', 'noiseWalls',
                    'bridgesPCGirder', 'bridgesSteel', 'bridgesRehab',
                    'miscStructures', 'geotechnical',
                    'systems', 'track', 'environmental',
                    'digitalDelivery'
                ];
            }

            for (const discId of disciplineOrder) {
                // For Wall projects, config comes from benchmark data
                // For standard projects, config comes from DISCIPLINE_CONFIG
                const benchmarks = getBenchmarkDataSync(discId);
                const config = activeBenchmarkDataset === 'border-wall' && benchmarks
                    ? {
                        id: discId,
                        name: benchmarks.displayName || benchmarks.discipline || discId,
                        accountCode: benchmarks.account_code || '—',
                        unit: benchmarks.eqty_metric?.uom || 'EA'
                    }
                    : DISCIPLINE_CONFIG[discId];

                if (!config) continue;

                const defaultRate = benchmarks ? (benchmarks.customRate || benchmarks.defaultRate) : 0;

                // Get all available projects for this discipline (full project objects)
                const allProjects = benchmarks && benchmarks.projects ? benchmarks.projects : [];

                // Force ALL projects to be applicable/selected by default (except ESDC/TSCD: use JSON "Applicable Job" or Excel tab)
                if (allProjects.length > 0 && discId !== 'esdc' && discId !== 'tscd') {
                    allProjects.forEach(project => {
                        project.applicable = true;  // Force all to true, overriding any false values
                    });
                }

                // Calculate rate: for ESDC/TSCD use only applicable (selected) projects; for others use all projects
                const isEsdcTscd = (discId === 'esdc' || discId === 'tscd');
                const rateSourceProjects = isEsdcTscd
                    ? allProjects.filter(p => p.applicable)
                    : allProjects;
                const calculatedRate = rateSourceProjects.length > 0
                    ? BenchmarkStats.calculateRateStats(rateSourceProjects).mean
                    : defaultRate;

                // Initialize state if not exists
                if (!mhEstimateState.disciplines[discId]) {
                    mhEstimateState.disciplines[discId] = {
                        active: true,
                        quantity: 0,
                        rate: calculatedRate,
                        mh: 0,
                        l4Percentage: 60,
                        laborCost: 0,
                        burdenCost: 0,
                        gnaCost: 0,
                        totalCost: 0,
                        selectedProjects: allProjects
                    };
                }

                const row = createUnifiedRow(discId, config, benchmarks);
                tbody.appendChild(row);
            }

            // Apply default subs/ODC percentages from constants (single source of truth for first load)
            const setDefaultIfUnset = (id, defaultVal, optionalOldDefault) => {
                const el = document.getElementById(id);
                if (!el) return;
                const num = parseFloat(el.value);
                const isUnset = el.value === '' || num === 0.25 || (optionalOldDefault != null && num === optionalOldDefault);
                if (isUnset) el.value = defaultVal;
            };
            setDefaultIfUnset('survey-subs-pct', DEFAULT_SURVEY_SUBS_PCT);
            setDefaultIfUnset('subsurface-utility-subs-pct', DEFAULT_SUBSURFACE_UTILITY_SUBS_PCT);
            setDefaultIfUnset('geotech-subs-pct', DEFAULT_GEOTECH_SUBS_PCT, 0.25);
            setDefaultIfUnset('odcs-pct', DEFAULT_ODCS_PCT);

            // Setup event listeners for cost parameters
            setupUnifiedEventListeners();

            // Apply initial complexity setting from dropdown
            applyGlobalComplexity();

            // Force all benchmarks to be selected and rates calculated (ESDC/TSCD excluded: selection = "Yes" in Applicable column only)
            for (const discId of Object.keys(mhEstimateState.disciplines)) {
                if (discId === 'esdc' || discId === 'tscd') continue;

                const state = mhEstimateState.disciplines[discId];
                if (!state.active) continue;

                // Get benchmarks and ensure all are applicable (only for non–ESDC/TSCD disciplines)
                const benchmarks = getBenchmarkDataSync(discId);
                if (benchmarks && benchmarks.projects) {
                    benchmarks.projects.forEach(p => { p.applicable = true; });
                }

                // Update display even with quantity 0 to show the correct rate
                const rateElem = document.getElementById(`unified-rate-${discId}`);
                if (rateElem && state.rate) {
                    const config = DISCIPLINE_CONFIG[discId];
                    const benchmarks = getBenchmarkDataSync(discId);
                    const unit = config?.unit || benchmarks?.eqty_metric?.uom || 'EA';
                    rateElem.textContent = formatRate(state.rate, unit);
                }
            }

            // Initial summary update
            updateUnifiedSummary();

            // Enable column resizing
            enableColumnResizing();
        }

        /**
         * Create a unified table row for a discipline
         */
        function createUnifiedRow(discId, config, benchmarks) {
            const row = document.createElement('tr');
            row.id = `unified-row-${discId}`;

            const state = mhEstimateState.disciplines[discId];
            const allProjects = benchmarks ? benchmarks.projects || [] : [];
            const isEsdcTscd = (discId === 'esdc' || discId === 'tscd');
            let allProjectsRate = allProjects.length > 0 ? BenchmarkStats.calculateRateStats(allProjects).mean : 0;
            if (!isEsdcTscd && state.quantity > 0 && allProjects.length >= 2) {
                const curveRate = getRateFromAllProjectsCurve(discId, state.quantity);
                if (curveRate != null) allProjectsRate = curveRate;
            }

            // Selected rate: use the same as All Rate initially (since all projects are selected by default)
            // For ESDC/TSCD we only use selected data (no "All")
            const selectedRate = state.rate || allProjectsRate;

            // Use data from JSON when available, fallback to config
            // For Wall projects, use displayName which includes metric type (Alignment/Barrier)
            let disciplineName = (benchmarks && benchmarks.displayName)
                ? benchmarks.displayName
                : (benchmarks && benchmarks.discipline)
                    ? benchmarks.discipline
                    : config.name;

            // Add visual badge for Wall projects to distinguish Alignment vs Barrier
            let metricBadge = '';
            if (activeBenchmarkDataset === 'border-wall' && benchmarks && benchmarks.displayName) {
                if (benchmarks.displayName.toLowerCase().includes('alignment length')) {
                    metricBadge = '<span style="display: inline-block; background: #1976d2; color: white; padding: 2px 6px; border-radius: 3px; font-size: 9px; margin-left: 6px; font-weight: bold;">ALIGNMENT</span>';
                } else if (benchmarks.displayName.toLowerCase().includes('barrier length')) {
                    metricBadge = '<span style="display: inline-block; background: #d32f2f; color: white; padding: 2px 6px; border-radius: 3px; font-size: 9px; margin-left: 6px; font-weight: bold;">BARRIER</span>';
                }
                // Use just the base discipline name + badge for cleaner display
                const baseName = benchmarks.discipline || disciplineName.split(' - ')[0];
                disciplineName = baseName + metricBadge;
            }

            const accountCode = (benchmarks && benchmarks.account_code) ? benchmarks.account_code : (config.accountCode || '—');
            const unit = (benchmarks && benchmarks.eqty_metric && benchmarks.eqty_metric.uom) ? benchmarks.eqty_metric.uom : config.unit;

            // ESDC/TSCD: benchmark picker next to description; quantity from assumed cost (read-only "—" in table)
            const descCell = isEsdcTscd
                ? `<td class="frozen-col">${disciplineName} <button class="btn-benchmark-select" onclick="showDisciplineBenchmark('${discId}')" title="Select benchmark projects">📊 Select</button></td>`
                : `<td class="frozen-col">${disciplineName}</td>`;
            const qtyCell = isEsdcTscd
                ? `<td class="mh-col numeric" title="Uses Assumed Construction Cost from Cost Parameters">—</td>`
                : `<td class="mh-col numeric">
                    <input type="text" class="qty-input" id="unified-qty-${discId}"
                           value="${(state.quantity || 0).toLocaleString('en-US')}" inputmode="numeric"
                           oninput="(function(d){ clearTimeout(window._uqD[d]); window._uqD=window._uqD||{}; window._uqD[d]=setTimeout(function(){ updateUnifiedQuantity(d); }, 350); })('${discId}')"
                           onchange="updateUnifiedQuantity('${discId}')"
                           onblur="updateUnifiedQuantity('${discId}')">
                </td>`;
            const benchmarkCell = isEsdcTscd
                ? `<td class="mh-col" title="Picker is next to discipline name">—</td>`
                : `<td class="mh-col">
                    <button class="btn-benchmark-select" onclick="showDisciplineBenchmark('${discId}')">
                        📊 Select
                    </button>
                </td>`;

            row.innerHTML = `
                ${descCell}
                <td class="mh-col">${accountCode}</td>
                ${qtyCell}
                <td class="mh-col">${unit}</td>
                ${benchmarkCell}
                <td class="mh-col numeric ${isEsdcTscd ? 'esdc-tscd-no-all' : ''}" ${isEsdcTscd ? 'title="Not used for ESDC/TSCD — only selected projects"' : ''}>
                    <span id="unified-rate-all-${discId}">${isEsdcTscd ? '—' : formatRate(allProjectsRate, unit)}</span>
                </td>
                <td class="mh-col numeric">
                    <span id="unified-rate-${discId}">${formatRate(selectedRate, unit)}</span>
                </td>
                <td class="mh-col numeric">
                    <span id="unified-wide-open-mh-${discId}">${formatMH(Math.round(((isEsdcTscd ? selectedRate : (state.allRate != null ? state.allRate : allProjectsRate)) || 0) * (state.quantity || 0)))}</span>
                </td>
                <td class="mh-col numeric">
                    <span id="unified-custom-mh-${discId}">${formatMH(state.mh || Math.round((state.quantity || 0) * (selectedRate || 0)))}</span>
                </td>
                <td class="mh-col numeric">
                    <input type="number" class="l4-input" id="unified-l4-${discId}"
                           value="${state.l4Percentage || 60}" min="0" max="100" step="5"
                           onchange="updateUnifiedL4('${discId}')"
                           title="Complexity: % of senior engineers (L4-L6) in team">
                </td>
                <td class="mh-col mh-col-keep numeric mh-cell">
                    <span id="unified-mh-${discId}">0</span>
                    <div id="unified-complexity-breakdown-${discId}" class="complexity-breakdown">
                        <span style="font-size: 9px; color: #1565c0;">L4+: 0 hrs</span><br>
                        <span style="font-size: 9px; color: #666;">L1-3: 0 hrs</span>
                    </div>
                </td>
                <td class="mh-col mh-toggle-cell"></td>
                <td class="cost-col numeric">
                    <span id="unified-hourly-rate-${discId}">$0</span>
                </td>
                <td class="cost-col numeric">
                    <span id="unified-total-revenue-${discId}">$0</span>
                </td>
                <td class="cost-col numeric revenue-detail-col">
                    <span id="unified-raw-labor-${discId}">$0</span>
                </td>
                <td class="cost-col numeric revenue-detail-col">
                    <span id="unified-burden-${discId}">$0</span>
                </td>
                <td class="cost-col numeric">
                    <span id="unified-total-cost-${discId}">$0</span>
                </td>
                <td class="cost-col numeric revenue-detail-col">
                    <span id="unified-gna-${discId}">$0</span>
                </td>
                <td class="cost-col numeric revenue-detail-col">
                    <span id="unified-margin-${discId}">$0</span>
                </td>
                <td class="cost-col numeric">
                    <span id="unified-expenses-${discId}">$0</span>
                </td>
            `;

            return row;
        }

        /** Debounce timers for unified quantity input (so All Rate updates as you type) */
        const unifiedQtyDebounceTimers = {};

        /**
         * Update quantity and recalculate MH
         */
        function updateUnifiedQuantity(discId) {
            const qtyInput = document.getElementById(`unified-qty-${discId}`);
            if (!qtyInput) return;

            const quantity = parseFloat(String(qtyInput.value).replace(/[,\s]/g, '')) || 0;

            const state = mhEstimateState.disciplines[discId];
            if (!state) return;

            const config = DISCIPLINE_CONFIG[discId];
            const benchmarks = getBenchmarkDataSync(discId);
            const unit = config?.unit || benchmarks?.eqty_metric?.uom || 'EA';

            state.quantity = quantity;

            // Use existing estimateMH function
            const result = estimateMH(discId, quantity, state.selectedProjects);
            state.mh = result.mh;
            state.rate = result.rate;
            if (result.allRate != null) state.allRate = result.allRate;

            // For noise walls and bridges, apply selected rate to all related disciplines
            const group = getSharedRateGroup(discId);
            if (group && quantity > 0 && state.rate > 0) {
                // Apply this rate to all other disciplines in the group
                for (const otherDiscId of group.disciplines) {
                    if (otherDiscId !== discId) {
                        const otherState = mhEstimateState.disciplines[otherDiscId];
                        if (otherState) {
                            otherState.rate = state.rate;
                            otherState.allRate = state.allRate;
                            
                            // Recalculate MH if other discipline has quantity
                            if (otherState.quantity > 0) {
                                otherState.mh = Math.round(otherState.quantity * state.rate);
                                
                                // Update displays for other discipline
                                const otherConfig = DISCIPLINE_CONFIG[otherDiscId];
                                const otherBenchmarks = getBenchmarkDataSync(otherDiscId);
                                const otherUnit = otherConfig?.unit || otherBenchmarks?.eqty_metric?.uom || 'EA';
                                
                                const otherMhElem = document.getElementById(`unified-mh-${otherDiscId}`);
                                const otherRateElem = document.getElementById(`unified-rate-${otherDiscId}`);
                                const otherAllRateElem = document.getElementById(`unified-rate-all-${otherDiscId}`);
                                const otherWideOpenEl = document.getElementById(`unified-wide-open-mh-${otherDiscId}`);
                                const otherCustomMHEl = document.getElementById(`unified-custom-mh-${otherDiscId}`);
                                
                                if (otherMhElem) otherMhElem.textContent = formatMH(otherState.mh);
                                if (otherRateElem) otherRateElem.textContent = formatRate(state.rate, otherUnit);
                                if (otherAllRateElem) otherAllRateElem.textContent = formatRate(state.allRate, otherUnit);
                                if (otherWideOpenEl) otherWideOpenEl.textContent = formatMH(Math.round(otherState.quantity * state.allRate));
                                if (otherCustomMHEl) otherCustomMHEl.textContent = formatMH(otherState.mh);
                                
                                // Recalculate costs for other discipline
                                recalculateUnifiedCosts(otherDiscId);
                            } else {
                                // Just update rate display
                                const otherConfig = DISCIPLINE_CONFIG[otherDiscId];
                                const otherBenchmarks = getBenchmarkDataSync(otherDiscId);
                                const otherUnit = otherConfig?.unit || otherBenchmarks?.eqty_metric?.uom || 'EA';
                                const otherRateElem = document.getElementById(`unified-rate-${otherDiscId}`);
                                if (otherRateElem) otherRateElem.textContent = formatRate(state.rate, otherUnit);
                            }
                        }
                    }
                }
            }

            // All Rate = from All Projects power curve (not used for ESDC/TSCD — only selected data)
            const allRateEl = document.getElementById(`unified-rate-all-${discId}`);
            if (allRateEl) {
                if (discId === 'esdc' || discId === 'tscd') {
                    allRateEl.textContent = '—';
                } else if (quantity > 0 && benchmarks?.projects?.length >= 2) {
                    const curveRate = getRateFromAllProjectsCurve(discId, quantity);
                    if (curveRate != null) {
                        state.allRate = curveRate;
                        allRateEl.textContent = formatRate(curveRate, unit);
                    } else if (result.allRate != null) {
                        allRateEl.textContent = formatRate(result.allRate, unit);
                    }
                } else if (result.allRate != null) {
                    allRateEl.textContent = formatRate(result.allRate, unit);
                }
            }

            // Update MH display
            const mhElem = document.getElementById(`unified-mh-${discId}`);
            if (mhElem) {
                mhElem.textContent = formatMH(result.mh);
            }

            const rateElem = document.getElementById(`unified-rate-${discId}`);
            if (rateElem) {
                rateElem.textContent = formatRate(result.rate, unit);
            }

            // Wide Open MHs = for ESDC/TSCD use Selected Rate only; else All Rate × Quantity
            const allRateForWideOpen = (discId === 'esdc' || discId === 'tscd')
                ? result.rate
                : (state.allRate != null ? state.allRate : (quantity > 0 && benchmarks?.projects?.length >= 2 ? getRateFromAllProjectsCurve(discId, quantity) : null)) || result.allRate || 0;
            const wideOpenMH = Math.round(quantity * allRateForWideOpen);
            const customMH = result.mh;
            const wideOpenEl = document.getElementById(`unified-wide-open-mh-${discId}`);
            const customMHEl = document.getElementById(`unified-custom-mh-${discId}`);
            if (wideOpenEl) wideOpenEl.textContent = formatMH(wideOpenMH);
            if (customMHEl) customMHEl.textContent = formatMH(customMH);

            // Format quantity input with commas
            qtyInput.value = quantity.toLocaleString('en-US');

            // Update complexity breakdown (L4+ vs L1-3 hours)
            updateComplexityBreakdown(discId);

            // Recalculate costs
            recalculateUnifiedCosts(discId);
            updateUnifiedSummary();
            saveToLocalStorage();
        }

        /**
         * Parse Excel "Summary MH" (or "Summary - MH") sheet and push key quantities into unified quantity fields.
         * Looks for labels: Alignment Length, Barrier Length, Project Area, Drainage, Roadway, Traffic, MOT, Utilities, Relocations, etc.
         */
        function handleDillonFileUpload(event) {
            const file = event.target && event.target.files && event.target.files[0];
            if (!file) return;
            const fileInput = event.target;
            function runImport(XLSXLib) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    try {
                        const data = new Uint8Array(e.target.result);
                        const workbook = XLSXLib.read(data, { type: 'array' });
                    const sheetName = workbook.SheetNames.find(
                        n => /summary\s*[-]?\s*mh/i.test(String(n).trim())
                    );
                    if (!sheetName) {
                        alert('No sheet named "Summary MH" or "Summary - MH" found.');
                        return;
                    }
                    const sheet = workbook.Sheets[sheetName];
                    const rows = XLSXLib.utils.sheet_to_json(sheet, { header: 1, defval: '' });
                    const quantities = {};
                    const notesByDiscipline = {};
                    // Map Excel Summary MH discipline/category labels to app discIds.
                    // Match: Drainage, Environmental, MOT, Roadway, Traffic, Utilities, Retaining Walls,
                    // Noise Walls, Bridges (PC Girder / Steel / Rehabilitation), Misc Structures, Geotechnical.
                    // Roadway (Civil) = Roadway; same row also fills MOT and Traffic.
                    function disciplineLabelToDiscId(label) {
                        const s = String(label || '').toLowerCase().replace(/\s+/g, ' ').trim();
                        if (!s) return null;
                        if (/drainage/.test(s)) return 'drainage';
                        if (/environmental|permit/.test(s)) return 'environmental';
                        if (/^mot$|maintenance\s*of\s*traffic|m\.?o\.?t\.?/.test(s)) return 'mot';
                        if (/roadway|alignment\s*length|civil\s*roadway|roadway\s*\(?\s*civil/.test(s)) return 'roadway';
                        if (/^traffic$|traffic\s+signal|traffic\s+eng/.test(s)) return 'traffic';
                        if (/utilit(y|ies)|relocation/.test(s)) return 'utilities';
                        if (/retaining\s*wall|retaining\s*walls|retaining/.test(s)) return 'retainingWalls';
                        if (/noise\s*wall|noise\s*walls|noise\s*barrier/.test(s)) return 'noiseWalls';
                        if (/bridge/.test(s)) {
                            if (/steel|vehicle\s*[-–]\s*steel/.test(s)) return 'bridgesSteel';
                            if (/rehab|rehabilitation/.test(s)) return 'bridgesRehab';
                            if (/pc\s*girder|vehicle\s*[-–]\s*pc|precast|girder/.test(s)) return 'bridgesPCGirder';
                            return 'bridgesPCGirder';
                        }
                        if (/geotech|geotechnical|geo\s*tech/.test(s)) return 'geotechnical';
                        if (/misc\.?\s*struct|miscellaneous\s*struct|misc\s*structures/.test(s) || (s.indexOf('misc') >= 0 && s.indexOf('struct') >= 0)) return 'miscStructures';
                        if (/digital|dig\.?\s*eng/.test(s)) return 'digitalDelivery';
                        if (/system|electr/.test(s)) return 'systems';
                        if (/track/.test(s)) return 'track';
                        return null;
                    }
                    function parseNum(v) {
                        if (v == null) return null;
                        if (typeof v === 'number' && !Number.isNaN(v)) return v;
                        if (typeof v === 'string') return parseFloat(v.replace(/,/g, '')) || null;
                        return null;
                    }
                    function looksLikeAccountCode(v) {
                        if (v == null) return false;
                        const s = String(v).trim();
                        if (/^\d{2,3}\.\d{2}(\.\d{2,3})?(\s*,\s*\d{2,3}\.\d{2}(\.\d{2,3})?)*$/.test(s)) return true;
                        if (s.length <= 15 && /^\d{1,3}\.\d{2}/.test(s)) return true;
                        return false;
                    }
                    function setFromLabel(labelStr, num, qtyMap) {
                        const lower = String(labelStr || '').toLowerCase().trim();
                        if (num == null || Number.isNaN(num)) return;
                        const n = Math.round(Number(num));
                        if (lower === 'alignment length' || lower === 'alignment length (lf)' || lower === 'alignment') {
                            qtyMap.roadway = n; qtyMap.mot = n; qtyMap.traffic = n;
                        } else if (lower === 'barrier length' || lower === 'barrier length (lf)' || lower === 'barrier') {
                            if (qtyMap.roadway == null) qtyMap.roadway = n;
                        } else if (lower.includes('project area') || lower === 'drainage' || lower === 'acres') {
                            qtyMap.drainage = n;
                        } else if (lower.includes('utility') || lower.includes('relocation')) {
                            qtyMap.utilities = n;
                        } else if (lower.includes('retaining wall')) {
                            qtyMap.retainingWalls = n;
                        } else if (lower.includes('noise wall')) {
                            qtyMap.noiseWalls = n;
                        } else if (lower.includes('bridge')) {
                            qtyMap.bridgesPCGirder = n;
                        } else if (lower.includes('environmental') || lower.includes('permit count')) {
                            qtyMap.environmental = n;
                        }
                    }
                    var disciplineCol = -1;
                    var notesCol = -1;
                    var keyQuantityCol = -1;
                    var headerRow = 0;
                    function cellLooksLikeDiscipline(cell) {
                        var s = String(cell || '').toLowerCase().trim();
                        return /^discipline[s]?$/.test(s) || s === 'category' || /^discipline\s+name$/.test(s) || /^item\s*description$/.test(s) || s === 'item' || /^work\s*type$/.test(s) || s === 'type';
                    }
                    function cellLooksLikeKeyQuantity(cell) {
                        var s = String(cell || '').toLowerCase().trim();
                        if (/key\s*quantity|keyquantity|key\s*qty|keyqty|key\s*quantities/.test(s)) return true;
                        if (s.indexOf('key') >= 0 && (s.indexOf('quantity') >= 0 || s.indexOf('qty') >= 0)) return true;
                        return false;
                    }
                    function cellLooksLikeQuantity(cell) {
                        var s = String(cell || '').toLowerCase().trim();
                        return /^quantity$|^quantities$|^qty$/.test(s);
                    }
                    for (let r = 0; r < Math.min(rows.length, 20); r++) {
                        const row = rows[r];
                        if (!Array.isArray(row)) continue;
                        for (let c = 0; c < row.length; c++) {
                            const cell = row[c];
                            const cellStr = String(cell != null ? cell : '').toLowerCase().trim();
                            if (disciplineCol < 0 && cellLooksLikeDiscipline(cellStr)) { disciplineCol = c; headerRow = r; }
                            if (cellStr === 'notes') notesCol = c;
                            if (keyQuantityCol < 0 && cellLooksLikeKeyQuantity(cellStr)) keyQuantityCol = c;
                        }
                        if (disciplineCol >= 0 && keyQuantityCol >= 0) break;
                        if (disciplineCol >= 0 && (notesCol >= 0 || keyQuantityCol >= 0)) break;
                    }
                    if (keyQuantityCol < 0) {
                        for (let r = 0; r < Math.min(rows.length, 20); r++) {
                            const row = rows[r];
                            if (!Array.isArray(row)) continue;
                            for (let c = 0; c < row.length; c++) {
                                const cellStr = String(row[c] != null ? row[c] : '').toLowerCase().trim();
                                if (cellLooksLikeQuantity(cellStr)) { keyQuantityCol = c; break; }
                            }
                            if (keyQuantityCol >= 0) break;
                        }
                    }
                    if (disciplineCol >= 0 && keyQuantityCol >= 0) {
                        var maxInCol = 0;
                        for (let r = headerRow + 1; r < rows.length; r++) {
                            var val = parseNum(rows[r][keyQuantityCol]);
                            if (val != null && val > maxInCol && !looksLikeAccountCode(rows[r][keyQuantityCol])) maxInCol = val;
                        }
                        if (maxInCol > 0 && maxInCol < 1000) {
                            var bestCol = keyQuantityCol;
                            var bestMax = maxInCol;
                            var headerRowData = rows[headerRow];
                            if (Array.isArray(headerRowData)) {
                                for (var c = 0; c < headerRowData.length; c++) {
                                    if (c === disciplineCol) continue;
                                    var colMax = 0;
                                    for (let dr = headerRow + 1; dr < Math.min(rows.length, headerRow + 50); dr++) {
                                        var v = parseNum(rows[dr][c]);
                                        if (v != null && v > colMax && !looksLikeAccountCode(rows[dr][c])) colMax = v;
                                    }
                                    if (colMax > bestMax) { bestCol = c; bestMax = colMax; }
                                }
                                keyQuantityCol = bestCol;
                            }
                        }
                    }
                    var dillonQuantityDiscIds = [
                        'drainage', 'environmental', 'mot', 'roadway', 'traffic', 'utilities',
                        'retainingWalls', 'noiseWalls',
                        'bridgesPCGirder', 'bridgesSteel', 'bridgesRehab',
                        'miscStructures', 'geotechnical'
                    ];
                    if (disciplineCol >= 0 && keyQuantityCol >= 0) {
                        for (let r = headerRow + 1; r < rows.length; r++) {
                            const row = rows[r];
                            if (!Array.isArray(row)) continue;
                            const disciplineLabel = row[disciplineCol];
                            if (disciplineLabel == null || String(disciplineLabel).trim() === '') continue;
                            const rawQty = row[keyQuantityCol];
                            if (rawQty == null && rawQty !== 0) continue;
                            if (looksLikeAccountCode(rawQty)) continue;
                            const qtyVal = parseNum(rawQty);
                            if (qtyVal == null && qtyVal !== 0) continue;
                            const discId = disciplineLabelToDiscId(disciplineLabel);
                            if (!discId || dillonQuantityDiscIds.indexOf(discId) < 0) continue;
                            const rounded = Math.round(Number(qtyVal));
                            quantities[discId] = rounded;
                            if (discId === 'roadway') {
                                quantities.mot = rounded;
                                quantities.traffic = rounded;
                            }
                        }
                    } else {
                        for (let r = 0; r < rows.length; r++) {
                            const row = rows[r];
                            if (!Array.isArray(row)) continue;
                            for (let c = 0; c < row.length; c++) {
                                const cell = row[c];
                                const nextVal = row[c + 1];
                                if (looksLikeAccountCode(cell) || looksLikeAccountCode(nextVal)) continue;
                                const str = (cell != null && typeof cell === 'object' && cell.toString) ? cell.toString() : String(cell || '').trim();
                                const lower = str.toLowerCase();
                                let num = parseNum(nextVal);
                                if (num == null) num = parseNum(cell);
                                if (num == null || num <= 0) continue;
                                if (lower === 'alignment length' || lower === 'alignment length (lf)') {
                                    quantities.roadway = Math.round(num); quantities.mot = Math.round(num); quantities.traffic = Math.round(num);
                                } else if (lower === 'barrier length' || lower === 'barrier length (lf)') {
                                    if (quantities.roadway == null) quantities.roadway = Math.round(num);
                                } else if (lower.includes('project area') || lower === 'drainage') {
                                    quantities.drainage = Math.round(num);
                                } else if (lower.includes('utility') || lower.includes('relocation')) {
                                    quantities.utilities = Math.round(num);
                                } else if (lower.includes('retaining wall')) quantities.retainingWalls = Math.round(num);
                                else if (lower.includes('noise wall')) quantities.noiseWalls = Math.round(num);
                                else if (lower.includes('bridge')) quantities.bridgesPCGirder = Math.round(num);
                                else if (lower.includes('environmental') || lower.includes('permit')) quantities.environmental = Math.round(num);
                            }
                            if (row.length >= 2 && !looksLikeAccountCode(row[0]) && !looksLikeAccountCode(row[1])) {
                                setFromLabel(row[0], parseNum(row[1]), quantities);
                            }
                        }
                    }
                    if (disciplineCol >= 0 && notesCol >= 0) {
                        for (let r = headerRow + 1; r < rows.length; r++) {
                            const row = rows[r];
                            if (!Array.isArray(row)) continue;
                            const disciplineLabel = row[disciplineCol];
                            const notesText = row[notesCol];
                            const discId = disciplineLabelToDiscId(disciplineLabel);
                            if (!discId) continue;
                            const notesStr = (notesText != null && typeof notesText === 'object' && notesText.toString) ? notesText.toString() : String(notesText || '').trim();
                            if (!notesStr) continue;
                            if (!notesByDiscipline[discId]) notesByDiscipline[discId] = [];
                            notesByDiscipline[discId].push(notesStr);
                        }
                        var projectSynonyms = { 'sec 820': ['820', 'ih 820', 'ih 820 southeast'], 'sec820': ['820', 'ih 820'] };
                        for (const discId of Object.keys(notesByDiscipline)) {
                            if (discId === 'esdc' || discId === 'tscd') continue; // ESDC/TSCD selection = Applicable column "Yes" or ESDC/TSCD sheet only
                            const benchmarks = getBenchmarkDataSync(discId);
                            if (!benchmarks || !benchmarks.projects || benchmarks.projects.length === 0) continue;
                            const allNoteText = notesByDiscipline[discId].join(' ');
                            const tokens = allNoteText.split(/[,;|\n\r]+/).map(t => t.trim().toLowerCase()).filter(t => t.length > 1);
                            const selectAll = tokens.length === 0 || tokens.some(t => t === 'all' || t === 'all projects');
                            benchmarks.projects.forEach(p => {
                                const name = (p.name || p.project || '').toLowerCase();
                                if (selectAll) {
                                    p.applicable = true;
                                } else {
                                    var matches = tokens.some(tok => {
                                        if (name.includes(tok)) return true;
                                        if (tok.length >= 4 && name.includes(tok.substring(0, Math.min(8, tok.length)))) return true;
                                        var synonyms = projectSynonyms[tok] || (tok.replace(/\s/g, '') in projectSynonyms ? projectSynonyms[tok.replace(/\s/g, '')] : null);
                                        if (synonyms && synonyms.some(s => name.includes(s))) return true;
                                        if ((tok.indexOf('sec') >= 0 && tok.indexOf('820') >= 0) && name.includes('820')) return true;
                                        return false;
                                    });
                                    p.applicable = matches;
                                }
                            });
                        }
                    }
                    let applied = 0;
                    for (const discId of dillonQuantityDiscIds) {
                        if (quantities[discId] == null) continue;
                        const state = mhEstimateState.disciplines[discId];
                        if (!state) continue;
                        const val = quantities[discId];
                        state.quantity = val;
                        var unifiedInput = document.getElementById(`unified-qty-${discId}`);
                        var mhInput = document.getElementById(`mh-qty-${discId}`);
                        if (unifiedInput) {
                            unifiedInput.value = val.toLocaleString('en-US');
                            if (typeof updateUnifiedQuantity === 'function') updateUnifiedQuantity(discId);
                            applied++;
                        }
                        if (mhInput && mhInput !== unifiedInput) {
                            mhInput.value = val.toLocaleString('en-US');
                            if (typeof updateMHQuantity === 'function') updateMHQuantity(discId);
                            if (applied === 0) applied++;
                        }
                    }
                    // === Parse ESDC and TSCD sheets to select projects ===
                    let esdcTscdSelections = { esdc: [], tscd: [] };
                    // Get all sheet names (SheetNames array or keys of Sheets object; normalize for matching)
                    var allSheetNames = Array.isArray(workbook.SheetNames) ? workbook.SheetNames : Object.keys(workbook.Sheets || {});
                    function normalizeSheetName(n) {
                        return String(n || '').replace(/\s+/g, ' ').trim().toLowerCase().replace(/[\u200b-\u200f\ufeff]/g, '');
                    }
                    function findSheetByName(sheetNames, key) {
                        const k = key.toLowerCase();
                        for (var i = 0; i < sheetNames.length; i++) {
                            var norm = normalizeSheetName(sheetNames[i]);
                            if (norm === k || norm.startsWith(k) || norm.includes(k)) return sheetNames[i];
                        }
                        return undefined;
                    }
                    function isApplicableYes(val) {
                        var v = String(val || '').trim().toLowerCase();
                        return v === 'yes' || v === 'y' || v === 'true' || v === '1' || v === 'x';
                    }
                    var esdcSheetName = findSheetByName(allSheetNames, 'esdc');
                    if (esdcSheetName) {
                        const esdcSheet = workbook.Sheets[esdcSheetName];
                        const esdcRows = XLSXLib.utils.sheet_to_json(esdcSheet, { header: 1, defval: '' });
                        let projectColIdx = 0;
                        let applicableColIdx = -1;
                        let dataStartRow = 0;
                        if (esdcRows.length > 0) {
                            // Header can be on row 1–4 (Excel); try each until we find Project + Applicable
                            for (var hr = 0; hr <= 3 && hr < esdcRows.length; hr++) {
                                var headerRow = esdcRows[hr];
                                if (!Array.isArray(headerRow)) continue;
                                projectColIdx = 0;
                                applicableColIdx = -1;
                                for (var c = 0; c < headerRow.length; c++) {
                                    var cellVal = String(headerRow[c] || '').toLowerCase().trim();
                                    if (cellVal === 'project' || cellVal === 'project name' || cellVal.includes('project')) {
                                        projectColIdx = c;
                                    }
                                    if (cellVal === 'applicable job' || cellVal === 'applicable' || cellVal === 'applicable?' || cellVal === 'yes' || cellVal.includes('applicable')) {
                                        applicableColIdx = c;
                                    }
                                }
                                if (applicableColIdx >= 0) {
                                    dataStartRow = hr + 1;
                                    break;
                                }
                            }
                            // Extract project names only for rows marked "Yes" (ESDC tab: only selected projects)
                            if (applicableColIdx >= 0) {
                                for (let r = dataStartRow; r < esdcRows.length; r++) {
                                    const row = esdcRows[r];
                                    if (Array.isArray(row) && row[projectColIdx]) {
                                        const applicableVal = String(row[applicableColIdx] || '').trim();
                                        if (!isApplicableYes(applicableVal)) continue;
                                        const projName = String(row[projectColIdx]).trim();
                                        if (projName && projName.toLowerCase() !== 'project') {
                                            esdcTscdSelections.esdc.push(projName);
                                        }
                                    }
                                }
                            }
                        }
                        console.log('ESDC sheet "' + esdcSheetName + '" found with ' + esdcTscdSelections.esdc.length + ' projects (Yes only)');
                    } else {
                        console.log('ESDC sheet not found. Tab names in workbook: ' + allSheetNames.map(function(n) { return '"' + n + '"'; }).join(', '));
                    }

                    var tscdSheetName = findSheetByName(allSheetNames, 'tscd');
                    if (tscdSheetName) {
                        const tscdSheet = workbook.Sheets[tscdSheetName];
                        const tscdRows = XLSXLib.utils.sheet_to_json(tscdSheet, { header: 1, defval: '' });
                        // Find the Project column and the column that marks "Yes" (Applicable Job, Applicable, or Yes)
                        let projectColIdx = 0;
                        let applicableColIdx = -1;
                        let dataStartRow = 0;
                        if (tscdRows.length > 0) {
                            // Header can be on row 1–4 (Excel); try each until we find Project + Applicable
                            for (var hrT = 0; hrT <= 3 && hrT < tscdRows.length; hrT++) {
                                var headerRowT = tscdRows[hrT];
                                if (!Array.isArray(headerRowT)) continue;
                                projectColIdx = 0;
                                applicableColIdx = -1;
                                for (var ct = 0; ct < headerRowT.length; ct++) {
                                    var cellValT = String(headerRowT[ct] || '').toLowerCase().trim();
                                    if (cellValT === 'project' || cellValT === 'project name' || cellValT.includes('project')) {
                                        projectColIdx = ct;
                                    }
                                    if (cellValT === 'applicable job' || cellValT === 'applicable' || cellValT === 'applicable?' || cellValT === 'yes' || cellValT.includes('applicable')) {
                                        applicableColIdx = ct;
                                    }
                                }
                                if (applicableColIdx >= 0) {
                                    dataStartRow = hrT + 1;
                                    break;
                                }
                            }
                            // Extract project names only for rows marked "Yes" (TSCD tab: only selected projects)
                            if (applicableColIdx >= 0) {
                                for (let r = dataStartRow; r < tscdRows.length; r++) {
                                    const row = tscdRows[r];
                                    if (Array.isArray(row) && row[projectColIdx]) {
                                        const applicableVal = String(row[applicableColIdx] || '').trim();
                                        if (!isApplicableYes(applicableVal)) continue;
                                        const projName = String(row[projectColIdx]).trim();
                                        if (projName && projName.toLowerCase() !== 'project') {
                                            esdcTscdSelections.tscd.push(projName);
                                        }
                                    }
                                }
                            }
                        }
                        console.log('TSCD sheet "' + tscdSheetName + '" found with ' + esdcTscdSelections.tscd.length + ' projects (Yes only)');
                    } else {
                        console.log('TSCD sheet not found. Tab names in workbook: ' + allSheetNames.map(function(n) { return '"' + n + '"'; }).join(', '));
                    }

                    // Apply ESDC/TSCD project selections: full list, only the N names from Excel (e.g. 21) selected
                    let esdcMatched = 0, tscdMatched = 0;
                    let esdcProcessed = false, tscdProcessed = false;
                    for (const discId of ['esdc', 'tscd']) {
                        const projectNamesToSelect = esdcTscdSelections[discId];
                        if (projectNamesToSelect.length > 0) {
                            if (discId === 'esdc') esdcProcessed = true;
                            else tscdProcessed = true;
                        }
                        if (projectNamesToSelect.length === 0) continue;

                        const benchmarks = getBenchmarkDataSync(discId);
                        if (!benchmarks || !benchmarks.projects || benchmarks.projects.length === 0) continue;

                        benchmarks.projects.forEach(p => { p.applicable = false; });

                        let matchedCount = 0;
                        for (const targetName of projectNamesToSelect) {
                            const targetNorm = String(targetName || '').trim().toLowerCase();
                            if (!targetNorm) continue;
                            for (const project of benchmarks.projects) {
                                const projNorm = String(project.name || project.project || '').trim().toLowerCase();
                                const exactMatch = projNorm === targetNorm;
                                const projectContainsTarget = targetNorm.length >= 3 && projNorm.includes(targetNorm);
                                const targetContainsProject = projNorm.length >= 3 && targetNorm.includes(projNorm);
                                if (exactMatch || projectContainsTarget || targetContainsProject) {
                                    project.applicable = true;
                                    matchedCount++;
                                    break;
                                }
                            }
                        }

                        if (discId === 'esdc') esdcMatched = matchedCount;
                        else tscdMatched = matchedCount;
                        if (matchedCount > 0) {
                            console.log(`${discId.toUpperCase()}: Selected ${matchedCount} projects from ${projectNamesToSelect.length} names in Excel (full list: ${benchmarks.projects.length} projects)`);
                        }
                    }
                    fileInput.value = '';
                    if ((Object.keys(notesByDiscipline).length > 0 || esdcMatched > 0 || tscdMatched > 0) && typeof applyBenchmarkSelection === 'function') {
                        applyBenchmarkSelection();
                    }
                    if (applied > 0 || Object.keys(notesByDiscipline).length > 0 || esdcProcessed || tscdProcessed) {
                        updateUnifiedSummary();
                        saveToLocalStorage();
                        let msg = 'Dillon file imported.';
                        if (applied > 0) msg += '\n• ' + applied + ' of 13 quantity field(s) updated.';
                        if (Object.keys(notesByDiscipline).length > 0) msg += '\n• Benchmark project selection from Notes applied for ' + Object.keys(notesByDiscipline).length + ' discipline(s).';
                        // Always show ESDC and TSCD so user sees both every time
                        if (esdcProcessed || tscdProcessed) {
                            msg += '\n• ESDC and TSCD from Excel: ESDC ' + (esdcProcessed ? esdcMatched + ' project(s) selected' : 'sheet not in file') + '; TSCD ' + (tscdProcessed ? tscdMatched + ' project(s) selected' : 'sheet not in file') + '.';
                        } else {
                            msg += '\n• ESDC and TSCD: no ESDC/TSCD sheets found in Excel, or sheets have no "Applicable Job" column / no "Yes" rows.';
                        }
                        alert(msg);
                    } else {
                        var hint = 'Summary MH sheet should have a "Discipline" (or "Category") column and a "Key quantity" (or "Quantity") column. Data starts in the row below the header.';
                        if (disciplineCol < 0 || keyQuantityCol < 0) {
                            hint = 'Could not find required columns. Discipline: ' + (disciplineCol >= 0 ? 'col ' + disciplineCol : 'not found') + ', Key quantity: ' + (keyQuantityCol >= 0 ? 'col ' + keyQuantityCol : 'not found') + '. ' + hint;
                        } else if (Object.keys(quantities).length > 0) {
                            hint = 'Quantities were read (' + Object.keys(quantities).length + ' disciplines) but the quantity inputs may not be on screen. Try scrolling to the DIRECTS table or click "Calculate Estimated Hours" first, then re-upload.';
                        }
                        alert('No matching quantity labels or Notes found in the Summary MH sheet. ' + hint);
                    }
                } catch (err) {
                    console.error(err);
                    alert('Error reading Excel file: ' + (err.message || err));
                }
                };
                reader.readAsArrayBuffer(file);
            }
            if (window.XLSX) {
                runImport(window.XLSX);
            } else {
                var script = document.createElement('script');
                script.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
                script.onload = function() { runImport(window.XLSX); };
                script.onerror = function() {
                    alert('Could not load Excel library. Check your network or run: npm install xlsx');
                    fileInput.value = '';
                };
                document.head.appendChild(script);
            }
        }

        /**
         * Update complexity percentage (L4%) and recalculate costs
         */
        function updateUnifiedL4(discId) {
            const l4Input = document.getElementById(`unified-l4-${discId}`);
            if (!l4Input) return;

            const value = parseFloat(l4Input.value);
            // Allow 0 - only use default if NaN/empty
            const l4Pct = isNaN(value) ? 60 : Math.max(0, Math.min(100, value));

            const state = mhEstimateState.disciplines[discId];
            if (!state) return;

            state.l4Percentage = l4Pct;

            // Update complexity breakdown display
            updateComplexityBreakdown(discId);

            // Recalculate costs with new complexity (changes weighted hourly rate)
            recalculateUnifiedCosts(discId);
            updateUnifiedSummary();
            saveToLocalStorage();
        }

        /**
         * Update the complexity breakdown display (L4+ hours vs L1-3 hours)
         */
        function updateComplexityBreakdown(discId) {
            const state = mhEstimateState.disciplines[discId];
            const breakdownElem = document.getElementById(`unified-complexity-breakdown-${discId}`);

            if (!breakdownElem || !state) return;

            const totalMH = state.mh || 0;
            const l4Pct = (state.l4Percentage !== undefined && state.l4Percentage !== null) ? state.l4Percentage : 60;

            // Calculate hours breakdown
            const l4Hours = Math.round(totalMH * (l4Pct / 100));
            const l13Hours = Math.round(totalMH * ((100 - l4Pct) / 100));

            // Update display
            breakdownElem.innerHTML = `
                <span style="font-size: 9px; color: #1565c0;">L4+: ${l4Hours.toLocaleString('en-US')} hrs</span><br>
                <span style="font-size: 9px; color: #666;">L1-3: ${l13Hours.toLocaleString('en-US')} hrs</span>
            `;
        }

        /**
         * Apply global complexity setting to all disciplines
         * Low = 30%, Medium = 60%, High = 90%
         */
        function applyGlobalComplexity() {
            const complexitySelect = document.getElementById('unified-complexity');
            if (!complexitySelect) return;

            const complexity = complexitySelect.value;

            // Map complexity to percentage
            const complexityMap = {
                'Low': 30,
                'Med': 60,
                'High': 90
            };

            const defaultPct = complexityMap[complexity] || 60;

            // Apply to all disciplines
            for (const discId of Object.keys(mhEstimateState.disciplines)) {
                const state = mhEstimateState.disciplines[discId];
                if (state.active) {
                    state.l4Percentage = defaultPct;

                    // Update input field
                    const l4Input = document.getElementById(`unified-l4-${discId}`);
                    if (l4Input) {
                        l4Input.value = defaultPct;
                    }

                    // Update complexity breakdown
                    updateComplexityBreakdown(discId);

                    // Recalculate costs
                    recalculateUnifiedCosts(discId);
                }
            }

            updateUnifiedSummary();
            saveToLocalStorage();

            // Show feedback
            const complexityLabel = complexitySelect.options[complexitySelect.selectedIndex].text;
            console.log(`Applied ${complexityLabel} complexity (${defaultPct}%) to all disciplines`);
        }

        /**
         * Recalculate costs for a discipline using weighted hourly rate
         * For ESDC/TSCD: Works backwards from Revenue to Hours
         */
        function recalculateUnifiedCosts(discId) {
            const state = mhEstimateState.disciplines[discId];
            if (!state) return; // Skip if no state

            const config = DISCIPLINE_CONFIG[discId];
            const benchmarks = getBenchmarkDataSync(discId);

            // For Wall disciplines, config may not exist
            if (!config && !benchmarks) {
                console.warn(`No config or benchmarks for discipline: ${discId}`);
                return;
            }

            // Get discipline name from config or benchmarks
            const disciplineName = config?.name || benchmarks?.displayName || benchmarks?.discipline || discId;

            // Get discipline-specific resources
            const resources = getDisciplineResources(disciplineName);

            // Calculate weighted hourly rate based on L4%
            // Allow 0% (all junior) - only use default if undefined
            const l4Pct = (state.l4Percentage !== undefined && state.l4Percentage !== null) ? state.l4Percentage : 30;
            const lowPct = (100 - l4Pct) / 100;  // Junior percentage
            const highPct = l4Pct / 100;         // Senior percentage
            // ESDC/TSCD use fixed $64.50/hr rate; other disciplines use calculated weighted rate
            const weightedRate = (discId === 'esdc' || discId === 'tscd') 
                ? ESDC_TSCD_HOURLY_RATE 
                : (resources.lowRate * lowPct) + (resources.highRate * highPct);

            // Get global parameters
            const burdenRate = parseFloat(document.getElementById('unified-burden')?.value) || 66;
            const gnaRate = parseFloat(document.getElementById('unified-gna')?.value) || 104;
            const kieMultiplier = parseFloat(document.getElementById('calc-kie-multiplier')?.value) || 2.85;
            
            // Calculate margin percent: KIE Multiplier - 1 - Burden Rate - G&A Rate
            const marginPercent = (kieMultiplier - 1 - (burdenRate / 100) - (gnaRate / 100)) * 100;

            let rawLabor, burdenCost, gnaCost, marginCost, totalRevenue;
            
            // ESDC/TSCD: Revenue-based calculation (work backwards from revenue)
            // These disciplines use % of project cost to calculate Revenue first
            if (discId === 'esdc' || discId === 'tscd') {
                // For ESDC/TSCD, if we have pre-calculated revenue from benchmark, use it
                if (state.revenue && state.revenue > 0) {
                    totalRevenue = state.revenue;
                    // Back-calculate from Revenue
                    rawLabor = totalRevenue / kieMultiplier;
                    burdenCost = rawLabor * (burdenRate / 100);
                    gnaCost = rawLabor * (gnaRate / 100);
                    marginCost = rawLabor * (marginPercent / 100);
                    
                    // Back-calculate hours from Raw Labor
                    const calculatedMH = Math.round(rawLabor / weightedRate);
                    state.mh = calculatedMH;
                } else {
                    // If no pre-calculated revenue, calculate from project cost
                    const projectCostK = state.quantity || 0;
                    const rate = state.rate || 1; // Rate is % like 1.19 for 1.19%
                    const revenueK = projectCostK * (rate / 100);
                    totalRevenue = revenueK * 1000;
                    
                    // Back-calculate from Revenue
                    rawLabor = totalRevenue / kieMultiplier;
                    burdenCost = rawLabor * (burdenRate / 100);
                    gnaCost = rawLabor * (gnaRate / 100);
                    marginCost = rawLabor * (marginPercent / 100);
                    
                    // Back-calculate hours
                    state.mh = Math.round(rawLabor / weightedRate);
                }
            } else {
                // Standard disciplines: Calculate costs from MH using weighted rate
                rawLabor = state.mh * weightedRate;
                burdenCost = rawLabor * (burdenRate / 100);
                gnaCost = rawLabor * (gnaRate / 100);
                marginCost = rawLabor * (marginPercent / 100);
                totalRevenue = rawLabor + burdenCost + gnaCost + marginCost;
            }

            // Update state
            state.laborCost = rawLabor; // Keep as laborCost for backward compatibility
            state.burdenCost = burdenCost;
            state.gnaCost = gnaCost;
            state.marginCost = marginCost;
            state.totalRevenue = totalRevenue;
            state.weightedRate = weightedRate;

            // Update display with weighted rate (ESDC/TSCD: fixed $64.50; others: show L4 breakdown)
            const rateDisplay = (discId === 'esdc' || discId === 'tscd')
                ? `$${ESDC_TSCD_HOURLY_RATE.toFixed(2)}`
                : `$${weightedRate.toFixed(2)}<br><span style="font-size: 8px; color: #666;">${Math.round(lowPct * 100)}% ${resources.lowCode} + ${Math.round(highPct * 100)}% ${resources.highCode}</span>`;
            const hourlyRateElem = document.getElementById(`unified-hourly-rate-${discId}`);
            if (hourlyRateElem) {
                hourlyRateElem.innerHTML = rateDisplay;
            }

            const rawLaborElem = document.getElementById(`unified-raw-labor-${discId}`);
            if (rawLaborElem) {
                rawLaborElem.textContent = '$' + Math.round(rawLabor).toLocaleString('en-US');
            }

            const burdenElem = document.getElementById(`unified-burden-${discId}`);
            if (burdenElem) {
                burdenElem.textContent = '$' + Math.round(burdenCost).toLocaleString('en-US');
            }

            const gnaElem = document.getElementById(`unified-gna-${discId}`);
            if (gnaElem) {
                gnaElem.textContent = '$' + Math.round(gnaCost).toLocaleString('en-US');
            }

            const marginElem = document.getElementById(`unified-margin-${discId}`);
            if (marginElem) {
                marginElem.textContent = '$' + Math.round(marginCost).toLocaleString('en-US');
            }

            const totalRevenueElem = document.getElementById(`unified-total-revenue-${discId}`);
            if (totalRevenueElem) {
                totalRevenueElem.textContent = '$' + Math.round(totalRevenue).toLocaleString('en-US');
            }

            // Calculate and display Expenses and Total Cost for discipline rows
            // Disciplines have no expenses (expenses are tracked at section level)
            const disciplineExpenses = 0;
            // Total Cost = Raw Labor + Burden
            const totalCost = rawLabor + burdenCost;
            
            state.expenses = disciplineExpenses;
            state.totalCost = totalCost;

            const expensesElem = document.getElementById(`unified-expenses-${discId}`);
            if (expensesElem) {
                expensesElem.textContent = '$' + Math.round(disciplineExpenses).toLocaleString('en-US');
            }

            const totalCostElem = document.getElementById(`unified-total-cost-${discId}`);
            if (totalCostElem) {
                totalCostElem.textContent = '$' + Math.round(totalCost).toLocaleString('en-US');
            }
        }

        /**
         * Recalculate all costs
         */
        function recalculateAllUnifiedCosts() {
            // Recalculate Digital Delivery based on Assumed Construction Cost and Design Duration
            recalculateDigitalDelivery();
            
            for (const discId of Object.keys(mhEstimateState.disciplines)) {
                recalculateUnifiedCosts(discId);
            }
            updateUnifiedSummary();
            saveToLocalStorage();
        }

        /**
         * Recalculate Digital Delivery based on Assumed Construction Cost and Design Duration
         */
        function recalculateDigitalDelivery() {
            const state = mhEstimateState.disciplines.digitalDelivery;
            if (!state) return;
            
            // Get Assumed Construction Cost (in $ - convert to millions for calculation)
            const assumedCostInput = document.getElementById('calc-assumed-construction-cost');
            const assumedCostStr = assumedCostInput?.value?.replace(/[^0-9.]/g, '') || '0';
            const assumedConstructionCost = parseFloat(assumedCostStr) || 0;
            const assumedCostM = assumedConstructionCost / 1000000; // Convert to millions
            
            // Get Design Duration (months)
            const durationInput = document.getElementById('calc-design-duration');
            const durationMonths = parseInt(durationInput?.value) || 12;
            
            // Calculate Digital Delivery MH using 3-step process
            const result = calculateDigitalDeliveryMH(assumedCostM, durationMonths, 'Med');
            
            // Update state
            state.active = assumedCostM > 0;
            state.quantity = assumedCostM;
            state.mh = result.mh;
            state.rate = ESDC_TSCD_HOURLY_RATE; // $64.50/hr for ESDC/TSCD
            state.rawLabor = result.rawLabor;
            state.burden = result.burden;
            state.gna = result.gna;
            state.margin = result.margin;
            state.revenue = result.revenue;
            state.totalCost = result.totalCost;
            state.complexityScore = result.complexityScore;
            state.praColumn = result.praColumn;
            
            // Update display
            const mhEl = document.getElementById('unified-mh-digitalDelivery');
            const rateEl = document.getElementById('unified-rate-digitalDelivery');
            const qtyEl = document.getElementById('unified-qty-digitalDelivery');
            const rawLaborEl = document.getElementById('unified-raw-labor-digitalDelivery');
            const burdenEl = document.getElementById('unified-burden-digitalDelivery');
            const gnaEl = document.getElementById('unified-gna-digitalDelivery');
            const marginEl = document.getElementById('unified-margin-digitalDelivery');
            const revenueEl = document.getElementById('unified-revenue-digitalDelivery');
            const costEl = document.getElementById('unified-cost-digitalDelivery');
            
            if (mhEl) mhEl.textContent = formatMH(result.mh);
            if (rateEl) rateEl.textContent = '$' + ESDC_TSCD_HOURLY_RATE.toFixed(2);
            if (qtyEl) qtyEl.value = assumedCostM > 0 ? '$' + assumedCostM.toFixed(1) + 'M' : '0';
            if (rawLaborEl) rawLaborEl.textContent = '$' + Math.round(result.rawLabor).toLocaleString('en-US');
            if (burdenEl) burdenEl.textContent = '$' + Math.round(result.burden).toLocaleString('en-US');
            if (gnaEl) gnaEl.textContent = '$' + Math.round(result.gna).toLocaleString('en-US');
            if (marginEl) marginEl.textContent = '$' + Math.round(result.margin).toLocaleString('en-US');
            if (revenueEl) revenueEl.textContent = '$' + Math.round(result.revenue).toLocaleString('en-US');
            if (costEl) costEl.textContent = '$' + Math.round(result.totalCost).toLocaleString('en-US');
        }

        /**
         * Update FTE display in INDIRECTS section
         */
        function updateIndirectsFTE(fteCount) {
            const tbody = document.getElementById('unified-indirects-tbody');
            if (!tbody) return;

            // Clear existing content
            tbody.innerHTML = '';

            // Add FTE row
            const row = document.createElement('tr');
            row.className = 'category-row indent-level-2';
            row.innerHTML = `
                <td class="frozen-col indent-2" style="font-weight: 600;">Total FTEs: ${fteCount.toFixed(2)}</td>
                <td colspan="7" class="mh-col"></td>
                <td class="mh-col mh-col-keep"></td>
                <td class="mh-col mh-toggle-cell"></td>
                <td class="cost-col" colspan="6" style="font-size: 10px; color: #666; text-align: left;">
                    Based on ${fteCount.toFixed(2)} FTEs over design duration (173.33 hrs/month per FTE)
                </td>
            `;
            tbody.appendChild(row);
        }

        /**
         * Calculate escalation cost based on bell curve distribution and annual raises
         */
        function calculateEscalation(totalMH, totalRawLabor) {
            // Get input parameters
            const ntpDateInput = document.getElementById('calc-ntp-date');
            const durationInput = document.getElementById('calc-design-duration');
            const escalationRateInput = document.getElementById('unified-escalation');

            if (!ntpDateInput || !ntpDateInput.value || !durationInput || !durationInput.value) {
                return 0; // No escalation if dates not provided
            }

            if (totalMH === 0 || totalRawLabor === 0) {
                return 0; // No escalation if no manhours
            }

            const ntpDate = new Date(ntpDateInput.value);
            const durationMonths = parseFloat(durationInput.value) || 0;
            const escalationRate = parseFloat(escalationRateInput?.value || 3) / 100;

            if (durationMonths === 0) return 0;

            // Calculate end date
            const endDate = new Date(ntpDate);
            endDate.setMonth(endDate.getMonth() + durationMonths);

            // Generate bell curve distribution of hours over months
            const monthlyDistribution = generateBellCurve(durationMonths);

            // Calculate average hourly rate
            const avgHourlyRate = totalRawLabor / totalMH;

            // Calculate escalation cost by year periods (March 1 boundaries)
            let escalationCost = 0;
            let currentDate = new Date(ntpDate);

            for (let monthIndex = 0; monthIndex < durationMonths; monthIndex++) {
                const monthHours = totalMH * monthlyDistribution[monthIndex];
                const monthYear = currentDate.getFullYear();
                const monthNum = currentDate.getMonth(); // 0-11

                // Determine which "raise year" this month falls into
                // Raises happen March 1 (month 2), so:
                // - Jan, Feb of year N: still in raise year N-1
                // - Mar-Dec of year N: in raise year N
                let raiseYear;
                if (monthNum < 2) {
                    // January (0) or February (1)
                    raiseYear = monthYear - 1;
                } else {
                    // March (2) through December (11)
                    raiseYear = monthYear;
                }

                // Calculate years since NTP raise year
                const ntpYear = ntpDate.getFullYear();
                const ntpMonth = ntpDate.getMonth();
                let ntpRaiseYear;
                if (ntpMonth < 2) {
                    ntpRaiseYear = ntpYear - 1;
                } else {
                    ntpRaiseYear = ntpYear;
                }

                const yearsFromStart = raiseYear - ntpRaiseYear;

                // Apply compounded escalation for each year
                // Year 0: no escalation
                // Year 1: 1 × escalation
                // Year 2: 2 × escalation (compounded)
                const escalationFactor = yearsFromStart > 0 ? Math.pow(1 + escalationRate, yearsFromStart) - 1 : 0;
                const monthEscalationCost = monthHours * avgHourlyRate * escalationFactor;

                escalationCost += monthEscalationCost;

                // Move to next month
                currentDate.setMonth(currentDate.getMonth() + 1);
            }

            return escalationCost;
        }

        /**
         * Generate bell curve distribution for spreading hours over months
         * Returns array of percentages that sum to 1.0
         */
        function generateBellCurve(numMonths) {
            const distribution = [];
            const midpoint = numMonths / 2;
            const stdDev = numMonths / 4; // Standard deviation (controls curve width)

            // Generate bell curve values using normal distribution
            let sum = 0;
            for (let i = 0; i < numMonths; i++) {
                const x = i - midpoint;
                const value = Math.exp(-(x * x) / (2 * stdDev * stdDev));
                distribution.push(value);
                sum += value;
            }

            // Normalize to sum to 1.0
            return distribution.map(v => v / sum);
        }

        /**
         * Update summary row with weighted averages
         */
        function updateUnifiedSummary() {
            // Get Est. Construction Cost (needed for multiple calculations)
            const estConstructionCostInput = document.getElementById('calc-est-construction-cost');
            let estConstructionCost = 0;
            if (estConstructionCostInput && estConstructionCostInput.value) {
                // Remove $ and commas, then parse
                const cleanValue = estConstructionCostInput.value.replace(/[$,]/g, '');
                estConstructionCost = parseFloat(cleanValue) || 0;
            }

            // Get Assumed Construction Cost (needed for SUBS and ESDC/TSCD)
            const assumedCostInput = document.getElementById('calc-assumed-construction-cost');
            let assumedConstructionCost = 0;
            if (assumedCostInput && assumedCostInput.value) {
                const cleanValue = assumedCostInput.value.replace(/[$,]/g, '');
                assumedConstructionCost = parseFloat(cleanValue) || 0;
            }

            // Calculate DIRECTS totals (from discipline rows)
            let directsMH = 0;
            let directsRawLabor = 0;
            let directsBurden = 0;
            let directsExpenses = 0;

            for (const discId of Object.keys(mhEstimateState.disciplines)) {
                const state = mhEstimateState.disciplines[discId];
                // Exclude ESDC and TSCD from DIRECTS - they have their own sections
                if (state.active && discId !== 'esdc' && discId !== 'tscd') {
                    directsMH += state.mh || 0;
                    directsRawLabor += state.laborCost || 0;
                    directsBurden += state.burdenCost || 0;
                }
            }

            // Get G&A rate and calculate Margin %
            const burdenRate = parseFloat(document.getElementById('unified-burden')?.value || 66);
            const gnaRate = parseFloat(document.getElementById('unified-gna')?.value || 104);
            const kieMultiplier = parseFloat(document.getElementById('calc-kie-multiplier')?.value || 2.85);
            
            // Calculate margin percent: KIE Multiplier - 1 (raw labor) - Burden Rate - G&A Rate
            const marginPercent = (kieMultiplier - 1 - (burdenRate / 100) - (gnaRate / 100)) * 100;
            
            // Update the margin percent display
            const marginPercentInput = document.getElementById('calc-margin-percent');
            if (marginPercentInput) {
                marginPercentInput.value = marginPercent.toFixed(2) + '%';
            }

            // Calculate G&A and Margin for DIRECTS
            const directsGna = directsRawLabor * (gnaRate / 100);
            const directsMargin = directsRawLabor * (marginPercent / 100);
            const directsTotalLabor = directsRawLabor + directsBurden + directsGna + directsMargin;
            // Total Cost = Raw Labor + Burden
            const directsTotalCosts = directsRawLabor + directsBurden;
            const directsAvgRate = directsMH > 0 ? directsRawLabor / directsMH : 0;

            // Update DIRECTS row
            document.getElementById('unified-total-mh').textContent = formatMH(directsMH);
            document.getElementById('unified-avg-rate').innerHTML =
                '$' + directsAvgRate.toFixed(2) + '<br><span style="font-size: 8px; color: #666;">Weighted Avg</span>';
            document.getElementById('unified-total-raw-labor').textContent =
                '$' + Math.round(directsRawLabor).toLocaleString('en-US');
            document.getElementById('unified-total-burden').textContent =
                '$' + Math.round(directsBurden).toLocaleString('en-US');
            document.getElementById('unified-total-gna').textContent =
                '$' + Math.round(directsGna).toLocaleString('en-US');
            document.getElementById('unified-total-margin').textContent =
                '$' + Math.round(directsMargin).toLocaleString('en-US');
            document.getElementById('unified-total-revenue').textContent =
                '$' + Math.round(directsTotalLabor).toLocaleString('en-US');
            document.getElementById('unified-total-expenses').textContent =
                '$' + Math.round(directsExpenses).toLocaleString('en-US');
            document.getElementById('unified-total-cost').textContent =
                '$' + Math.round(directsTotalCosts).toLocaleString('en-US');

            // INDIRECTS - calculated as DIRECTS MH ÷ divisor at $87/hr (rounded to nearest whole number)
            // Check if Indirects is enabled
            const indirectsEnabled = document.getElementById('indirects-enabled-toggle')?.checked ?? true;
            const indirectsDivisor = parseFloat(document.getElementById('indirects-divisor')?.value) || 15;
            const indirectsMH = indirectsEnabled ? Math.round(directsMH / indirectsDivisor) : 0;
            const indirectsRate = 87; // Fixed rate for indirects
            const indirectsRawLabor = indirectsMH * indirectsRate;
            const indirectsBurden = indirectsRawLabor * (burdenRate / 100);
            const indirectsGna = indirectsRawLabor * (gnaRate / 100);
            const indirectsMargin = indirectsRawLabor * (marginPercent / 100);
            const indirectsTotalLabor = indirectsRawLabor + indirectsBurden + indirectsGna + indirectsMargin;
            const indirectsExpenses = 0;
            // Total Cost = Raw Labor + Burden
            const indirectsTotalCosts = indirectsRawLabor + indirectsBurden;

            // Calculate FTEs based on design duration
            const designDurationInput = document.getElementById('calc-design-duration');
            const designDurationMonths = parseFloat(designDurationInput?.value || 0);
            const fteCount = designDurationMonths > 0 ? indirectsMH / (designDurationMonths * 173.33) : 0;

            // Update INDIRECTS row
            document.getElementById('unified-indirect-total-mh').textContent = formatMH(indirectsMH);
            document.getElementById('unified-indirect-avg-rate').textContent = '$' + indirectsRate.toFixed(2);
            document.getElementById('unified-indirect-total-raw-labor').textContent =
                '$' + Math.round(indirectsRawLabor).toLocaleString('en-US');
            document.getElementById('unified-indirect-total-burden').textContent =
                '$' + Math.round(indirectsBurden).toLocaleString('en-US');
            document.getElementById('unified-indirect-total-gna').textContent =
                '$' + Math.round(indirectsGna).toLocaleString('en-US');
            document.getElementById('unified-indirect-total-margin').textContent =
                '$' + Math.round(indirectsMargin).toLocaleString('en-US');
            document.getElementById('unified-indirect-total-revenue').textContent =
                '$' + Math.round(indirectsTotalLabor).toLocaleString('en-US');
            document.getElementById('unified-indirect-total-expenses').textContent =
                '$' + Math.round(indirectsExpenses).toLocaleString('en-US');
            document.getElementById('unified-indirect-total-cost').textContent =
                '$' + Math.round(indirectsTotalCosts).toLocaleString('en-US');

            // Update FTE display in indirects tbody
            updateIndirectsFTE(fteCount);

            // Calculate KIE LABOR totals (DIRECTS + INDIRECTS)
            const kieLaborMH = directsMH + indirectsMH;
            const kieLaborRawLabor = directsRawLabor + indirectsRawLabor;
            const kieLaborBurden = directsBurden + indirectsBurden;
            const kieLaborGna = directsGna + indirectsGna;
            const kieLaborMargin = directsMargin + indirectsMargin;
            const kieLaborTotalLabor = kieLaborRawLabor + kieLaborBurden + kieLaborGna + kieLaborMargin;
            const kieLaborExpenses = directsExpenses + indirectsExpenses;
            // Total Cost = Raw Labor + Burden
            const kieLaborTotalCosts = kieLaborRawLabor + kieLaborBurden;
            const kieLaborAvgRate = kieLaborMH > 0 ? kieLaborRawLabor / kieLaborMH : 0;

            // Update KIE LABOR section
            document.getElementById('kie-labor-total-mh').textContent = formatMH(kieLaborMH);
            document.getElementById('kie-labor-avg-rate').textContent = '$' + kieLaborAvgRate.toFixed(2);
            document.getElementById('kie-labor-total-raw-labor').textContent =
                '$' + Math.round(kieLaborRawLabor).toLocaleString('en-US');
            document.getElementById('kie-labor-total-burden').textContent =
                '$' + Math.round(kieLaborBurden).toLocaleString('en-US');
            document.getElementById('kie-labor-total-gna').textContent =
                '$' + Math.round(kieLaborGna).toLocaleString('en-US');
            document.getElementById('kie-labor-total-margin').textContent =
                '$' + Math.round(kieLaborMargin).toLocaleString('en-US');
            document.getElementById('kie-labor-total-revenue').textContent =
                '$' + Math.round(kieLaborTotalLabor).toLocaleString('en-US');
            document.getElementById('kie-labor-total-expenses').textContent =
                '$' + Math.round(kieLaborExpenses).toLocaleString('en-US');
            document.getElementById('kie-labor-total-cost').textContent =
                '$' + Math.round(kieLaborTotalCosts).toLocaleString('en-US');

            // Calculate SUBS expenses based on Assumed Construction Cost
            // Each row reads from its corresponding percentage input
            // "Survey Subs" row (updates ls-subs-* elements) uses survey-subs-pct
            const surveySubsPctForLsSubs = parseFloat(document.getElementById('survey-subs-pct')?.value) || DEFAULT_SURVEY_SUBS_PCT;
            const lsSubsExpenses = assumedConstructionCost * (surveySubsPctForLsSubs / 100);

            // Update LS SUBS row
            const lsSubsTotalCosts = lsSubsExpenses; // Only expenses, no labor
            document.getElementById('ls-subs-total-mh').textContent = '0';
            document.getElementById('ls-subs-avg-rate').textContent = '$0.00';
            document.getElementById('ls-subs-total-raw-labor').textContent = '$0';
            document.getElementById('ls-subs-total-burden').textContent = '$0';
            document.getElementById('ls-subs-total-gna').textContent = '$0';
            document.getElementById('ls-subs-total-margin').textContent = '$0';
            // Total Revenue for subs includes expenses
            document.getElementById('ls-subs-total-revenue').textContent = 
                '$' + Math.round(lsSubsExpenses).toLocaleString('en-US');
            document.getElementById('ls-subs-total-expenses').textContent =
                '$' + Math.round(lsSubsExpenses).toLocaleString('en-US');
            document.getElementById('ls-subs-total-cost').textContent =
                '$' + Math.round(lsSubsTotalCosts).toLocaleString('en-US');

            // "Subsurface Utility Subs" row (updates survey-* elements) uses subsurface-utility-subs-pct
            const subsurfaceUtilitySubsPct = parseFloat(document.getElementById('subsurface-utility-subs-pct')?.value) || DEFAULT_SUBSURFACE_UTILITY_SUBS_PCT;
            const surveyExpenses = assumedConstructionCost * (subsurfaceUtilitySubsPct / 100);

            // Update SURVEY row
            const surveyTotalCosts = surveyExpenses; // Only expenses, no labor
            document.getElementById('survey-total-mh').textContent = '0';
            document.getElementById('survey-avg-rate').textContent = '$0.00';
            document.getElementById('survey-total-raw-labor').textContent = '$0';
            document.getElementById('survey-total-burden').textContent = '$0';
            document.getElementById('survey-total-gna').textContent = '$0';
            document.getElementById('survey-total-margin').textContent = '$0';
            // Total Revenue for subs includes expenses
            document.getElementById('survey-total-revenue').textContent = 
                '$' + Math.round(surveyExpenses).toLocaleString('en-US');
            document.getElementById('survey-total-expenses').textContent =
                '$' + Math.round(surveyExpenses).toLocaleString('en-US');
            document.getElementById('survey-total-cost').textContent =
                '$' + Math.round(surveyTotalCosts).toLocaleString('en-US');

            // "Geotech Drilling Subs" row (updates subsurface-utility-* elements) uses geotech-subs-pct
            const geotechSubsPct = parseFloat(document.getElementById('geotech-subs-pct')?.value) || DEFAULT_GEOTECH_SUBS_PCT;
            const subsurfaceUtilityExpenses = assumedConstructionCost * (geotechSubsPct / 100);

            // Update SUBSURFACE UTILITY SUBS row
            const subsurfaceUtilityTotalCosts = subsurfaceUtilityExpenses; // Only expenses, no labor
            document.getElementById('subsurface-utility-total-mh').textContent = '0';
            document.getElementById('subsurface-utility-avg-rate').textContent = '$0.00';
            document.getElementById('subsurface-utility-total-raw-labor').textContent = '$0';
            document.getElementById('subsurface-utility-total-burden').textContent = '$0';
            document.getElementById('subsurface-utility-total-gna').textContent = '$0';
            document.getElementById('subsurface-utility-total-margin').textContent = '$0';
            // Total Revenue for subs includes expenses
            document.getElementById('subsurface-utility-total-revenue').textContent = 
                '$' + Math.round(subsurfaceUtilityExpenses).toLocaleString('en-US');
            document.getElementById('subsurface-utility-total-expenses').textContent =
                '$' + Math.round(subsurfaceUtilityExpenses).toLocaleString('en-US');
            document.getElementById('subsurface-utility-total-cost').textContent =
                '$' + Math.round(subsurfaceUtilityTotalCosts).toLocaleString('en-US');

            // Calculate SUBS section totals (LS SUBS, SURVEY, SUBSURFACE UTILITY)
            const subsMH = 0;
            const subsRawLabor = 0;
            const subsBurden = 0;
            const subsGna = 0;
            const subsMargin = 0;
            const subsTotalLabor = subsRawLabor + subsBurden + subsGna + subsMargin;
            const subsExpenses = lsSubsExpenses + surveyExpenses + subsurfaceUtilityExpenses;
            // Total Cost = Raw Labor + Burden
            const subsTotalCosts = subsRawLabor + subsBurden;
            const subsAvgRate = subsMH > 0 ? subsRawLabor / subsMH : 0;

            // Update SUBS section
            document.getElementById('subs-section-total-mh').textContent = formatMH(subsMH);
            document.getElementById('subs-section-avg-rate').textContent = '$' + subsAvgRate.toFixed(2);
            document.getElementById('subs-section-total-raw-labor').textContent =
                '$' + Math.round(subsRawLabor).toLocaleString('en-US');
            document.getElementById('subs-section-total-burden').textContent =
                '$' + Math.round(subsBurden).toLocaleString('en-US');
            document.getElementById('subs-section-total-gna').textContent =
                '$' + Math.round(subsGna).toLocaleString('en-US');
            document.getElementById('subs-section-total-margin').textContent =
                '$' + Math.round(subsMargin).toLocaleString('en-US');
            // Total Revenue for SUBS section includes expenses (since subs have no labor)
            document.getElementById('subs-section-total-revenue').textContent =
                '$' + Math.round(subsExpenses).toLocaleString('en-US');
            document.getElementById('subs-section-total-expenses').textContent =
                '$' + Math.round(subsExpenses).toLocaleString('en-US');
            document.getElementById('subs-section-total-cost').textContent =
                '$' + Math.round(subsTotalCosts).toLocaleString('en-US');

            // Calculate IPC based on (KIE LABOR + SUBS) MH × IPC Fee
            // Check if IPC is enabled
            const ipcEnabled = document.getElementById('ipc-enabled-toggle')?.checked ?? true;
            const ipcFeeInput = document.getElementById('unified-ipc-fee');
            const ipcFeePerMH = ipcFeeInput ? parseFloat(ipcFeeInput.value) || 6 : 6;
            const totalMHForIPC = kieLaborMH + subsMH;
            const ipcExpenses = ipcEnabled ? totalMHForIPC * ipcFeePerMH : 0;

            // Update IPC row (only expenses column has a value)
            const ipcTotalCosts = ipcExpenses; // Only expenses, no labor
            document.getElementById('ipc-total-mh').textContent = '0';
            document.getElementById('ipc-avg-rate').textContent = '$0.00';
            document.getElementById('ipc-total-raw-labor').textContent = '$0';
            document.getElementById('ipc-total-burden').textContent = '$0';
            document.getElementById('ipc-total-gna').textContent = '$0';
            document.getElementById('ipc-total-margin').textContent = '$0';
            document.getElementById('ipc-total-revenue').textContent = '$0';
            document.getElementById('ipc-total-expenses').textContent =
                '$' + Math.round(ipcExpenses).toLocaleString('en-US');
            document.getElementById('ipc-total-cost').textContent =
                '$' + Math.round(ipcTotalCosts).toLocaleString('en-US');

            // Calculate ODC: Read percentage from UI input
            const odcsPct = parseFloat(document.getElementById('odcs-pct')?.value) || DEFAULT_ODCS_PCT;
            const odcsExpenses = assumedConstructionCost * (odcsPct / 100);

            // Update ODC'S row
            const odcsTotalCosts = odcsExpenses; // Only expenses, no labor
            document.getElementById('odcs-total-mh').textContent = '0';
            document.getElementById('odcs-avg-rate').textContent = '$0.00';
            document.getElementById('odcs-total-raw-labor').textContent = '$0';
            document.getElementById('odcs-total-burden').textContent = '$0';
            document.getElementById('odcs-total-gna').textContent = '$0';
            document.getElementById('odcs-total-margin').textContent = '$0';
            // ODC's are billable, so include expenses in revenue
            document.getElementById('odcs-total-revenue').textContent = 
                '$' + Math.round(odcsExpenses).toLocaleString('en-US');
            document.getElementById('odcs-total-expenses').textContent =
                '$' + Math.round(odcsExpenses).toLocaleString('en-US');
            document.getElementById('odcs-total-cost').textContent =
                '$' + Math.round(odcsTotalCosts).toLocaleString('en-US');

            // Calculate EXPENSES section totals (IPC + ODC'S)
            const expensesSectionExpenses = ipcExpenses + odcsExpenses;
            const expensesSectionTotalCosts = expensesSectionExpenses; // Only expenses, no labor

            // Update EXPENSES section
            document.getElementById('expenses-section-total-mh').textContent = '0';
            document.getElementById('expenses-section-avg-rate').textContent = '$0.00';
            document.getElementById('expenses-section-total-raw-labor').textContent = '$0';
            document.getElementById('expenses-section-total-burden').textContent = '$0';
            document.getElementById('expenses-section-total-gna').textContent = '$0';
            document.getElementById('expenses-section-total-margin').textContent = '$0';
            // Only ODC's are billable (IPC is not), so revenue = ODC's only
            document.getElementById('expenses-section-total-revenue').textContent = 
                '$' + Math.round(odcsExpenses).toLocaleString('en-US');
            document.getElementById('expenses-section-total-expenses').textContent =
                '$' + Math.round(expensesSectionExpenses).toLocaleString('en-US');
            document.getElementById('expenses-section-total-cost').textContent =
                '$' + Math.round(expensesSectionTotalCosts).toLocaleString('en-US');

            // G&A is now calculated as a column, not a row
            // The G&A column totals are already included in the LABOR section

            // Calculate ESCALATION based on raises over design duration
            const escalationExpenses = calculateEscalation(kieLaborMH, kieLaborRawLabor);

            // Update ESCALATION row
            document.getElementById('escalation-total-mh').textContent = '0';
            document.getElementById('escalation-avg-rate').textContent = '$0.00';
            document.getElementById('escalation-total-raw-labor').textContent = '$0';
            document.getElementById('escalation-total-burden').textContent = '$0';
            document.getElementById('escalation-total-gna').textContent = '$0';
            // Display escalation value in the margin column (where the button is now)
            const escalationMarginCell = document.getElementById('escalation-total-margin');
            if (escalationMarginCell) {
                escalationMarginCell.innerHTML = '$' + Math.round(escalationExpenses).toLocaleString('en-US') + 
                    ' <button class="escalation-details-btn" onclick="openEscalationModal()" title="View Escalation Breakdown">📊</button>';
            }
            document.getElementById('escalation-total-revenue').textContent = '$0';
            document.getElementById('escalation-total-expenses').textContent =
                '$' + Math.round(escalationExpenses).toLocaleString('en-US');
            document.getElementById('escalation-total-cost').textContent =
                '$' + Math.round(escalationExpenses).toLocaleString('en-US');

            // Calculate CONTINGENCY: 5% of (Directs + Indirects MH) × Average Rate
            const contingencyPercentInput = document.getElementById('unified-contingency');
            const contingencyPercent = contingencyPercentInput ? parseFloat(contingencyPercentInput.value) || 5 : 5;
            
            // Total MH from Directs + Indirects (which is kieLaborMH)
            const contingencyBaseMH = directsMH + indirectsMH;
            // 5% of total MH
            const contingencyMH = Math.round(contingencyBaseMH * (contingencyPercent / 100));
            // Average rate from directs + indirects
            const contingencyAvgRate = contingencyBaseMH > 0 ? (directsRawLabor + indirectsRawLabor) / contingencyBaseMH : 0;
            // Contingency raw labor = contingency MH × avg rate
            const contingencyRawLabor = contingencyMH * contingencyAvgRate;
            // Calculate burden, G&A, and margin for contingency
            const contingencyBurden = contingencyRawLabor * (burdenRate / 100);
            const contingencyGna = contingencyRawLabor * (gnaRate / 100);
            const contingencyMargin = contingencyRawLabor * (marginPercent / 100);
            const contingencyTotalRevenue = contingencyRawLabor + contingencyBurden + contingencyGna + contingencyMargin;
            // Total Cost = Raw Labor + Burden
            const contingencyTotalCosts = contingencyRawLabor + contingencyBurden;

            // Update CONTINGENCY row
            document.getElementById('contingency-total-mh').textContent = formatMH(contingencyMH);
            document.getElementById('contingency-avg-rate').textContent = '$' + contingencyAvgRate.toFixed(2);
            document.getElementById('contingency-total-raw-labor').textContent = 
                '$' + Math.round(contingencyRawLabor).toLocaleString('en-US');
            document.getElementById('contingency-total-burden').textContent = 
                '$' + Math.round(contingencyBurden).toLocaleString('en-US');
            document.getElementById('contingency-total-gna').textContent = 
                '$' + Math.round(contingencyGna).toLocaleString('en-US');
            document.getElementById('contingency-total-margin').textContent = 
                '$' + Math.round(contingencyMargin).toLocaleString('en-US');
            document.getElementById('contingency-total-revenue').textContent = 
                '$' + Math.round(contingencyTotalRevenue).toLocaleString('en-US');
            document.getElementById('contingency-total-expenses').textContent = '$0';
            document.getElementById('contingency-total-cost').textContent =
                '$' + Math.round(contingencyTotalCosts).toLocaleString('en-US');

            // Calculate ESDC and TSCD based on ASSUMED CONSTRUCTION COST
            // (assumedConstructionCost already defined at top of function)

            // Helper function to calculate ESDC/TSCD from Assumed Construction Cost
            // Uses SELECTED power curve: production % at assumed cost, then Revenue = Assumed × (production %), MH = Raw Labor / $64.50
            function calculateServiceRevenue(discId) {
                const benchmarks = getBenchmarkDataSync(discId);
                if (!benchmarks || assumedConstructionCost <= 0) {
                    return { mh: 0, rate: 0, revenue: 0, rawLabor: 0, burden: 0, gna: 0, margin: 0 };
                }

                // Production % from SELECTED power curve at assumed construction cost (x = project cost in K$)
                const assumedCostK = assumedConstructionCost / 1000;
                let productionPct = getProductionPctFromSelectedCurve(discId, assumedCostK);
                if (productionPct == null || productionPct <= 0) {
                    const selectedProjects = benchmarks.projects.filter(p => p.applicable);
                    if (selectedProjects.length > 0) {
                        const totalRate = selectedProjects.reduce((sum, p) => sum + (p.rate || p.production_pct || 0), 0);
                        productionPct = totalRate / selectedProjects.length;
                    } else {
                        productionPct = benchmarks.customRate || 1;
                    }
                }

                // Revenue = Assumed Construction Cost × (production % / 100)
                const revenue = assumedConstructionCost * (productionPct / 100);

                // Raw Labor = Revenue / KIE Multiplier
                const rawLabor = revenue / kieMultiplier;
                const burden = rawLabor * (burdenRate / 100);
                const gna = rawLabor * (gnaRate / 100);
                const margin = rawLabor * (marginPercent / 100);
                // Est MH = Raw Labor / ESDC-TSCD hourly rate ($64.50)
                const mh = Math.round(rawLabor / ESDC_TSCD_HOURLY_RATE);

                return { mh, rate: productionPct, revenue, rawLabor, burden, gna, margin };
            }

            // ESDC calculation
            const esdcCalc = calculateServiceRevenue('esdc');

            // Update ESDC row
            const esdcMhEl = document.getElementById('esdc-total-mh');
            const esdcRateEl = document.getElementById('esdc-avg-rate');
            const esdcRawLaborEl = document.getElementById('esdc-total-raw-labor');
            const esdcBurdenEl = document.getElementById('esdc-total-burden');
            const esdcGnaEl = document.getElementById('esdc-total-gna');
            const esdcMarginEl = document.getElementById('esdc-total-margin');
            const esdcRevenueEl = document.getElementById('esdc-total-revenue');
            
            if (esdcMhEl) esdcMhEl.textContent = formatMH(esdcCalc.mh);
            if (esdcRateEl) esdcRateEl.textContent = esdcCalc.rate.toFixed(2) + '%';
            if (esdcRawLaborEl) esdcRawLaborEl.textContent = '$' + Math.round(esdcCalc.rawLabor).toLocaleString('en-US');
            if (esdcBurdenEl) esdcBurdenEl.textContent = '$' + Math.round(esdcCalc.burden).toLocaleString('en-US');
            if (esdcGnaEl) esdcGnaEl.textContent = '$' + Math.round(esdcCalc.gna).toLocaleString('en-US');
            if (esdcMarginEl) esdcMarginEl.textContent = '$' + Math.round(esdcCalc.margin).toLocaleString('en-US');
            if (esdcRevenueEl) esdcRevenueEl.textContent = '$' + Math.round(esdcCalc.revenue).toLocaleString('en-US');
            const esdcExpensesEl = document.getElementById('esdc-total-expenses');
            const esdcCostEl = document.getElementById('esdc-total-cost');
            if (esdcExpensesEl) esdcExpensesEl.textContent = '$0'; // ESDC is labor-based, no expenses
            // Total Cost = Raw Labor + Burden
            const esdcTotalCost = esdcCalc.rawLabor + esdcCalc.burden;
            if (esdcCostEl) esdcCostEl.textContent = '$' + Math.round(esdcTotalCost).toLocaleString('en-US');

            // TSCD calculation
            const tscdCalc = calculateServiceRevenue('tscd');

            // Update TSCD row
            const tscdMhEl = document.getElementById('tscd-total-mh');
            const tscdRateEl = document.getElementById('tscd-avg-rate');
            const tscdRawLaborEl = document.getElementById('tscd-total-raw-labor');
            const tscdBurdenEl = document.getElementById('tscd-total-burden');
            const tscdGnaEl = document.getElementById('tscd-total-gna');
            const tscdMarginEl = document.getElementById('tscd-total-margin');
            const tscdRevenueEl = document.getElementById('tscd-total-revenue');
            
            if (tscdMhEl) tscdMhEl.textContent = formatMH(tscdCalc.mh);
            if (tscdRateEl) tscdRateEl.textContent = tscdCalc.rate.toFixed(2) + '%';
            if (tscdRawLaborEl) tscdRawLaborEl.textContent = '$' + Math.round(tscdCalc.rawLabor).toLocaleString('en-US');
            if (tscdBurdenEl) tscdBurdenEl.textContent = '$' + Math.round(tscdCalc.burden).toLocaleString('en-US');
            if (tscdGnaEl) tscdGnaEl.textContent = '$' + Math.round(tscdCalc.gna).toLocaleString('en-US');
            if (tscdMarginEl) tscdMarginEl.textContent = '$' + Math.round(tscdCalc.margin).toLocaleString('en-US');
            if (tscdRevenueEl) tscdRevenueEl.textContent = '$' + Math.round(tscdCalc.revenue).toLocaleString('en-US');
            const tscdExpensesEl = document.getElementById('tscd-total-expenses');
            const tscdCostEl = document.getElementById('tscd-total-cost');
            if (tscdExpensesEl) tscdExpensesEl.textContent = '$0'; // TSCD is labor-based, no expenses
            // Total Cost = Raw Labor + Burden
            const tscdTotalCost = tscdCalc.rawLabor + tscdCalc.burden;
            if (tscdCostEl) tscdCostEl.textContent = '$' + Math.round(tscdTotalCost).toLocaleString('en-US');

            // ============================================
            // GRAND TOTALS
            // ============================================
            // Sum all sections: KIE Labor + SUBS + Expenses + Contingency + ESDC + TSCD + Escalation
            const grandTotalMH = kieLaborMH + subsMH + contingencyMH + (esdcCalc?.mh || 0) + (tscdCalc?.mh || 0);
            const grandTotalRawLabor = kieLaborRawLabor + subsRawLabor + contingencyRawLabor + (esdcCalc?.rawLabor || 0) + (tscdCalc?.rawLabor || 0);
            const grandTotalBurden = kieLaborBurden + subsBurden + contingencyBurden + (esdcCalc?.burden || 0) + (tscdCalc?.burden || 0);
            const grandTotalGna = kieLaborGna + subsGna + contingencyGna + (esdcCalc?.gna || 0) + (tscdCalc?.gna || 0);
            const grandTotalMargin = kieLaborMargin + subsMargin + contingencyMargin + (esdcCalc?.margin || 0) + (tscdCalc?.margin || 0);
            const grandTotalExpenses = kieLaborExpenses + subsExpenses + expensesSectionExpenses + escalationExpenses;
            // SUBS revenue = labor portion (0) + expenses (which are included in grandTotalExpenses)
            const grandTotalRevenue = kieLaborTotalLabor + subsTotalLabor + subsExpenses + contingencyTotalRevenue + (esdcCalc?.revenue || 0) + (tscdCalc?.revenue || 0) + odcsExpenses;
            const grandTotalCost = grandTotalRawLabor + grandTotalBurden;

            // Update Grand Totals row
            const grandMhEl = document.getElementById('grand-total-mh');
            const grandRevenueEl = document.getElementById('grand-total-revenue');
            const grandRawLaborEl = document.getElementById('grand-total-raw-labor');
            const grandBurdenEl = document.getElementById('grand-total-burden');
            const grandCostEl = document.getElementById('grand-total-cost');
            const grandGnaEl = document.getElementById('grand-total-gna');
            const grandMarginEl = document.getElementById('grand-total-margin');
            const grandExpensesEl = document.getElementById('grand-total-expenses');

            if (grandMhEl) grandMhEl.textContent = formatMH(grandTotalMH);
            if (grandRevenueEl) grandRevenueEl.textContent = '$' + Math.round(grandTotalRevenue).toLocaleString('en-US');
            if (grandRawLaborEl) grandRawLaborEl.textContent = '$' + Math.round(grandTotalRawLabor).toLocaleString('en-US');
            if (grandBurdenEl) grandBurdenEl.textContent = '$' + Math.round(grandTotalBurden).toLocaleString('en-US');
            if (grandCostEl) grandCostEl.textContent = '$' + Math.round(grandTotalCost).toLocaleString('en-US');
            if (grandGnaEl) grandGnaEl.textContent = '$' + Math.round(grandTotalGna).toLocaleString('en-US');
            if (grandMarginEl) grandMarginEl.textContent = '$' + Math.round(grandTotalMargin).toLocaleString('en-US');
            if (grandExpensesEl) grandExpensesEl.textContent = '$' + Math.round(grandTotalExpenses).toLocaleString('en-US');
        }

        /**
         * Setup event listeners for cost parameters
         */
        function setupUnifiedEventListeners() {
            // Debounced recalculation for cost parameters (no hourly rate - it's per-discipline)
            let recalcTimer = null;
            const debouncedRecalc = () => {
                clearTimeout(recalcTimer);
                recalcTimer = setTimeout(recalculateAllUnifiedCosts, 300);
            };

            const costParams = ['unified-burden', 'unified-gna', 'unified-contingency', 'unified-ipc-fee', 'unified-escalation', 'calc-est-construction-cost', 'calc-assumed-construction-cost', 'calc-kie-multiplier', 'calc-sub-multiplier', 'indirects-divisor', 'calc-design-duration', 'survey-subs-pct', 'subsurface-utility-subs-pct', 'geotech-subs-pct', 'odcs-pct'];
            costParams.forEach(id => {
                const elem = document.getElementById(id);
                if (elem) {
                    elem.addEventListener('input', debouncedRecalc);
                }
            });

            // Add accounting format to Est. Construction Cost field
            const estCostInput = document.getElementById('calc-est-construction-cost');
            if (estCostInput) {
                estCostInput.addEventListener('blur', function() {
                    const cleanValue = this.value.replace(/[^0-9.]/g, '');
                    if (cleanValue) {
                        const numValue = parseFloat(cleanValue);
                        if (!isNaN(numValue)) {
                            this.value = Math.round(numValue).toLocaleString('en-US');
                        }
                    }
                });

                estCostInput.addEventListener('focus', function() {
                    // Remove commas when user focuses for easier editing
                    this.value = this.value.replace(/,/g, '');
                });
            }
        }

        /**
         * Apply unified estimate to budget
         */
        function applyUnifiedEstimate() {
            let totalCost = 0;
            let totalMH = 0;
            let totalLabor = 0;

            for (const discId of Object.keys(mhEstimateState.disciplines)) {
                const state = mhEstimateState.disciplines[discId];
                if (state.active && state.mh > 0) {
                    totalCost += state.totalCost;
                    totalMH += state.mh;
                    totalLabor += state.laborCost;

                    // Map to WBS discipline name
                    const wbsName = mapMHDisciplineToWBS(discId);
                    if (wbsName && projectData.budgets[wbsName] !== undefined) {
                        projectData.budgets[wbsName] = state.totalCost;
                    }
                }
            }

            // Update calculator state
            projectData.calculator.totalDesignFee = totalCost;
            projectData.calculator.isCalculated = true;

            // Update budget table if it exists
            if (typeof buildBudgetTable === 'function') {
                buildBudgetTable();
            }

            const burdenPct = document.getElementById('unified-burden').value;
            const gnaPct = document.getElementById('unified-gna').value;
            const contingencyPct = document.getElementById('unified-contingency').value;
            const avgRate = totalMH > 0 ? totalLabor / totalMH : 0;

            alert(`✅ Estimate Applied!\n\nTotal MH: ${formatMH(totalMH)}\nWeighted Avg Rate: $${avgRate.toFixed(2)}/hr\nTotal Cost: $${Math.round(totalCost).toLocaleString('en-US')}\n\nRates calculated per discipline using L4% complexity mix\nIncludes burden (${burdenPct}%), G&A (${gnaPct}%), and contingency (${contingencyPct}%)`);

            saveToLocalStorage();
        }

        /**
         * Reset unified estimate
         */
        function resetUnifiedEstimate() {
            if (!confirm('⚠️ Reset all MH estimates and cost calculations?')) return;

            // Reset all disciplines
            for (const discId of Object.keys(mhEstimateState.disciplines)) {
                const state = mhEstimateState.disciplines[discId];
                state.quantity = 0;
                state.mh = 0;
                state.laborCost = 0;
                state.burdenCost = 0;
                state.gnaCost = 0;
                state.totalCost = 0;
                state.selectedProjects = [];
            }

            // Reinitialize table (this will call applyGlobalComplexity)
            initUnifiedEstimator();
            saveToLocalStorage();
        }

        /**
         * Toggle MH columns visibility
         */
        function toggleMHColumns() {
            const table = document.getElementById('unified-estimate-table');
            const icon = document.getElementById('toggle-mh-icon');
            const button = document.querySelector('.btn-toggle-mh-inline');

            if (table.classList.contains('mh-collapsed')) {
                // Show MH columns
                table.classList.remove('mh-collapsed');
                icon.textContent = '◀';
                if (button) {
                    button.title = 'Hide man-hour estimation columns';
                }
            } else {
                // Hide MH columns
                table.classList.add('mh-collapsed');
                icon.textContent = '▶';
                if (button) {
                    button.title = 'Show man-hour estimation columns';
                }
            }
        }

        /**
         * Enable column resizing with drag handles
         */
        function enableColumnResizing() {
            const table = document.getElementById('unified-estimate-table');
            if (!table) return;

            const headers = table.querySelectorAll('thead th');

            headers.forEach((th, index) => {
                // Skip the toggle button column
                if (th.classList.contains('mh-toggle-header')) return;

                // Add resize handle
                const resizeHandle = document.createElement('div');
                resizeHandle.className = 'resize-handle';
                th.appendChild(resizeHandle);

                let startX, startWidth;

                resizeHandle.addEventListener('mousedown', (e) => {
                    e.preventDefault();
                    startX = e.pageX;
                    startWidth = th.offsetWidth;

                    table.classList.add('resizing');

                    const mouseMoveHandler = (e) => {
                        const diff = e.pageX - startX;
                        const newWidth = Math.max(30, startWidth + diff); // Min width 30px
                        th.style.width = newWidth + 'px';
                        th.style.minWidth = newWidth + 'px';
                        th.style.maxWidth = newWidth + 'px';
                    };

                    const mouseUpHandler = () => {
                        table.classList.remove('resizing');
                        document.removeEventListener('mousemove', mouseMoveHandler);
                        document.removeEventListener('mouseup', mouseUpHandler);
                    };

                    document.addEventListener('mousemove', mouseMoveHandler);
                    document.addEventListener('mouseup', mouseUpHandler);
                });
            });
        }

        /**
         * Calculate MH estimates based on parameters
         */
        function calculateMHEstimates() {
            const projectType = document.getElementById('unified-project-type').value;
            const complexity = document.getElementById('unified-complexity').value;

            // Apply global complexity
            applyGlobalComplexity();

            // Recalculate all MH estimates
            for (const discId of Object.keys(mhEstimateState.disciplines)) {
                const state = mhEstimateState.disciplines[discId];
                if (state.active && state.quantity > 0) {
                    // Recalculate MH with current rate
                    const result = estimateMH(discId, state.quantity, state.selectedProjects);
                    state.mh = result.mh;
                    state.rate = result.rate;
                    if (result.allRate != null) state.allRate = result.allRate;

                    // Update display
                    const mhElem = document.getElementById(`unified-mh-${discId}`);
                    if (mhElem) mhElem.textContent = formatMH(result.mh);
                    const allRateEl = document.getElementById(`unified-rate-all-${discId}`);
                    if (discId === 'esdc' || discId === 'tscd') { if (allRateEl) allRateEl.textContent = '—'; }
                    const wideOpenEl = document.getElementById(`unified-wide-open-mh-${discId}`);
                    const customMHEl = document.getElementById(`unified-custom-mh-${discId}`);
                    const wideOpenRate = (discId === 'esdc' || discId === 'tscd') ? result.rate : (state.allRate != null ? state.allRate : result.allRate || 0);
                    if (wideOpenEl) wideOpenEl.textContent = formatMH(Math.round(state.quantity * wideOpenRate));
                    if (customMHEl) customMHEl.textContent = formatMH(result.mh);

                    // Update complexity breakdown
                    updateComplexityBreakdown(discId);

                    // Recalculate costs
                    recalculateUnifiedCosts(discId);
                }
            }

            updateUnifiedSummary();
            saveToLocalStorage();

            // Auto-minimize parameters section after calculation
            const paramsSection = document.getElementById('mh-params-section');
            if (paramsSection && !paramsSection.classList.contains('collapsed')) {
                collapseMHParams();
            }

            // Show feedback
            const complexityMap = { 'Low': '30%', 'Med': '60%', 'High': '90%' };
            alert(`✅ Estimated Hours Calculated!\n\nProject Type: ${projectType}\nComplexity: ${complexity} (${complexityMap[complexity]})\n\n⚠️ Please check and update quantities and applicable benchmarks\n\nParameters section minimized - click header to expand.`);
        }

        /**
         * Toggle MH Parameters section visibility
         */
        function toggleMHParams() {
            const section = document.getElementById('mh-params-section');
            const icon = document.getElementById('mh-params-icon');
            const summary = document.getElementById('mh-params-summary');

            if (section.classList.contains('collapsed')) {
                // Expand
                section.classList.remove('collapsed');
                icon.textContent = '▼';
                summary.style.display = 'none';  // Hide summary when expanded
            } else {
                // Collapse
                collapseMHParams();
            }
        }

        /**
         * Collapse MH Parameters section
         */
        function collapseMHParams() {
            const section = document.getElementById('mh-params-section');
            const icon = document.getElementById('mh-params-icon');
            const summary = document.getElementById('mh-params-summary');
            const summaryType = document.getElementById('summary-type');
            const summaryComplexity = document.getElementById('summary-complexity');

            // Get current values
            const projectType = document.getElementById('unified-project-type');
            const complexity = document.getElementById('unified-complexity');

            if (projectType && complexity && summaryType && summaryComplexity) {
                // Update summary text with current selections
                summaryType.textContent = projectType.options[projectType.selectedIndex].text;

                const complexityText = complexity.options[complexity.selectedIndex].text;
                const complexityMap = { 'Low': '30%', 'Med': '60%', 'High': '90%' };
                summaryComplexity.textContent = `${complexityText} (${complexityMap[complexity.value]})`;
            }

            // Show summary, collapse section
            if (summary) {
                summary.style.display = 'block';
            }
            section.classList.add('collapsed');
            icon.textContent = '▶';
        }

        /**
         * Toggle Cost Calculation Parameters section
         */
        function toggleCostParams() {
            const section = document.getElementById('cost-params-section');
            const icon = document.getElementById('cost-params-icon');
            const content = document.getElementById('cost-params-content');

            if (section.classList.contains('collapsed')) {
                // Expand
                section.classList.remove('collapsed');
                icon.textContent = '▼';
            } else {
                // Collapse
                section.classList.add('collapsed');
                icon.textContent = '▶';
            }
        }

        /**
         * Toggle Unified Input Panel visibility
         */
        function toggleUnifiedPanel() {
            const panel = document.getElementById('unified-input-panel');
            const icon = document.getElementById('unified-panel-icon');
            const summary = document.getElementById('unified-panel-summary');

            if (panel.classList.contains('collapsed')) {
                // Expand
                panel.classList.remove('collapsed');
                icon.textContent = '▼';
                summary.style.display = 'none';
            } else {
                // Collapse
                panel.classList.add('collapsed');
                icon.textContent = '▶';
                summary.style.display = 'block';
            }
        }

        /**
         * Toggle Unified Table visibility (collapse to show only Directs totals)
         */
        function toggleUnifiedTable() {
            const wrapper = document.querySelector('.unified-table-wrapper');
            const icon = document.getElementById('unified-table-icon');
            const summary = document.getElementById('unified-table-summary');

            if (wrapper.classList.contains('collapsed')) {
                // Expand - show full table
                wrapper.classList.remove('collapsed');
                icon.textContent = '▼';
                summary.style.display = 'none';
            } else {
                // Collapse - show only Directs totals
                wrapper.classList.add('collapsed');
                icon.textContent = '▶';
                summary.style.display = 'block';
            }
        }

        /**
         * Toggle visibility of discipline rows under Directs
         */
        function toggleDirectsRows() {
            const tbody = document.getElementById('unified-estimate-tbody');
            const icon = document.getElementById('directs-toggle-icon');

            if (tbody.classList.contains('hidden')) {
                // Expand - show all disciplines
                tbody.classList.remove('hidden');
                icon.textContent = '▼';
            } else {
                // Collapse - hide disciplines
                tbody.classList.add('hidden');
                icon.textContent = '▶';
            }
        }

        /**
         * Toggle visibility of indirect rows under Indirects
         */
        function toggleIndirectsRows() {
            const tbody = document.getElementById('unified-indirects-tbody');
            const icon = document.getElementById('indirects-toggle-icon');
            const divisorWrapper = document.querySelector('.indirects-divisor-wrapper');
            const toggleSwitch = document.querySelector('.indirects-toggle-switch');

            if (tbody.classList.contains('hidden')) {
                // Expand - show all indirects
                tbody.classList.remove('hidden');
                icon.textContent = '▼';
                // Show divisor controls when expanded
                if (divisorWrapper) divisorWrapper.style.display = 'inline-flex';
                if (toggleSwitch) toggleSwitch.style.display = 'inline-block';
            } else {
                // Collapse - hide indirects
                tbody.classList.add('hidden');
                icon.textContent = '▶';
                // Hide divisor controls when collapsed
                if (divisorWrapper) divisorWrapper.style.display = 'none';
                if (toggleSwitch) toggleSwitch.style.display = 'none';
            }
        }

        /**
         * Toggle visibility of subsections (SUBS, EXPENSES subsections)
         * @param {string} sectionId - ID prefix of the section (e.g., 'ls-subs', 'survey', 'ipc', etc.)
         */
        function toggleSubsRow(sectionId) {
            const tbody = document.getElementById(`${sectionId}-tbody`);
            const icon = document.getElementById(`${sectionId}-toggle-icon`);

            if (tbody && icon) {
                if (tbody.classList.contains('hidden')) {
                    // Expand
                    tbody.classList.remove('hidden');
                    icon.textContent = '▼';
                } else {
                    // Collapse
                    tbody.classList.add('hidden');
                    icon.textContent = '▶';
                }
            }
        }

        /**
         * Toggle IPC enabled/disabled state
         */
        function toggleIpcEnabled() {
            const isEnabled = document.getElementById('ipc-enabled-toggle')?.checked ?? true;
            const ipcSection = document.getElementById('ipc-section');
            const ipcTbody = document.getElementById('ipc-tbody');
            
            if (ipcSection) {
                if (isEnabled) {
                    ipcSection.style.opacity = '1';
                } else {
                    ipcSection.style.opacity = '0.5';
                }
            }
            if (ipcTbody) {
                if (isEnabled) {
                    ipcTbody.style.opacity = '1';
                } else {
                    ipcTbody.style.opacity = '0.5';
                }
            }
            
            // Recalculate unified costs
            recalculateAllUnifiedCosts();
        }

        /**
         * Toggle Indirects enabled/disabled state
         */
        function toggleIndirectsEnabled() {
            const isEnabled = document.getElementById('indirects-enabled-toggle')?.checked ?? true;
            const indirectsRow = document.querySelector('#indirects-section-header');
            const indirectsTbody = document.getElementById('indirects-tbody');
            
            if (indirectsRow) {
                indirectsRow.style.opacity = isEnabled ? '1' : '0.5';
            }
            if (indirectsTbody) {
                indirectsTbody.style.opacity = isEnabled ? '1' : '0.5';
            }
            
            // Recalculate unified costs
            recalculateAllUnifiedCosts();
        }

        /**
         * Adjust indirects divisor up or down
         */
        function adjustIndirectsDivisor(delta) {
            const input = document.getElementById('indirects-divisor');
            if (input) {
                let value = parseInt(input.value) || 15;
                value = Math.max(1, Math.min(50, value + delta));
                input.value = value;
                // Trigger recalculation
                recalculateAllUnifiedCosts();
            }
        }

        function toggleKieLaborSection() {
            // Get the DIRECTS summary row (child of directsHeader tbody)
            const directsSummaryRow = document.querySelector('#unified-estimate-tbody-header tr.summary-row');
            const directsTbody = document.getElementById('unified-estimate-tbody');
            const indirectsSection = document.getElementById('unified-indirects-section');
            const indirectsTbody = document.getElementById('unified-indirects-tbody');
            const icon = document.getElementById('kie-labor-toggle-icon');

            if (icon) {
                const isCollapsed = directsTbody && directsTbody.classList.contains('hidden');

                if (isCollapsed) {
                    // Expand - show DIRECTS and INDIRECTS rows
                    if (directsSummaryRow) directsSummaryRow.classList.remove('hidden');
                    if (directsTbody) directsTbody.classList.remove('hidden');
                    if (indirectsSection) indirectsSection.classList.remove('hidden');
                    if (indirectsTbody) indirectsTbody.classList.remove('hidden');
                    icon.textContent = '▼';
                } else {
                    // Collapse - hide all subsections, keep only KIE LABOR header visible
                    if (directsSummaryRow) directsSummaryRow.classList.add('hidden');
                    if (directsTbody) directsTbody.classList.add('hidden');
                    if (indirectsSection) indirectsSection.classList.add('hidden');
                    if (indirectsTbody) indirectsTbody.classList.add('hidden');
                    icon.textContent = '▶';
                }
            }
        }

        function toggleSubsSection() {
            const lsSubsSection = document.getElementById('ls-subs-section');
            const lsSubsTbody = document.getElementById('ls-subs-tbody');
            const surveySection = document.getElementById('survey-section');
            const surveyTbody = document.getElementById('survey-tbody');
            const subsurfaceSection = document.getElementById('subsurface-utility-section');
            const subsurfaceTbody = document.getElementById('subsurface-utility-tbody');
            const icon = document.getElementById('subs-section-toggle-icon');

            if (icon) {
                const isCollapsed = lsSubsSection && lsSubsSection.classList.contains('hidden');

                // Toggle all sub-section rows (LS SUBS, SURVEY, SUBSURFACE UTILITY)
                const allElements = [
                    lsSubsSection, lsSubsTbody,
                    surveySection, surveyTbody,
                    subsurfaceSection, subsurfaceTbody
                ];

                if (isCollapsed) {
                    // Expand - show all subsection rows
                    allElements.forEach(elem => {
                        if (elem) elem.classList.remove('hidden');
                    });
                    icon.textContent = '▼';
                } else {
                    // Collapse - hide all subsection rows, keep SUBS header visible with totals
                    allElements.forEach(elem => {
                        if (elem) elem.classList.add('hidden');
                    });
                    icon.textContent = '▶';
                }
            }
        }

        function toggleExpensesSection() {
            const ipcSection = document.getElementById('ipc-section');
            const ipcTbody = document.getElementById('ipc-tbody');
            const odcsSection = document.getElementById('odcs-section');
            const odcsTbody = document.getElementById('odcs-tbody');
            const icon = document.getElementById('expenses-section-toggle-icon');

            if (icon) {
                const isCollapsed = ipcSection && ipcSection.classList.contains('hidden');

                // Toggle IPC and ODC'S sections (both header rows and detail rows)
                const allElements = [ipcSection, ipcTbody, odcsSection, odcsTbody];

                if (isCollapsed) {
                    // Expand - show IPC and ODC'S rows
                    allElements.forEach(elem => {
                        if (elem) elem.classList.remove('hidden');
                    });
                    icon.textContent = '▼';
                } else {
                    // Collapse - hide IPC and ODC'S rows, keep EXPENSES header visible with totals
                    allElements.forEach(elem => {
                        if (elem) elem.classList.add('hidden');
                    });
                    icon.textContent = '▶';
                }
            }
        }

        /**
         * Handle benchmark dataset change
         */
        // Export to window for HTML onclick handlers
        window.initUnifiedEstimator = initUnifiedEstimator;
        window.updateUnifiedQuantity = updateUnifiedQuantity;
        window.updateUnifiedL4 = updateUnifiedL4;
        window.applyGlobalComplexity = applyGlobalComplexity;
        window.calculateMHEstimates = calculateMHEstimates;
        window.handleBenchmarkDatasetChange = handleBenchmarkDatasetChange;
        window.toggleMHParams = toggleMHParams;
        window.toggleCostParams = toggleCostParams;
        window.toggleUnifiedPanel = toggleUnifiedPanel;
        window.toggleUnifiedTable = toggleUnifiedTable;
        window.toggleDirectsRows = toggleDirectsRows;
        window.toggleIndirectsRows = toggleIndirectsRows;
        window.toggleSubsRow = toggleSubsRow;
        window.toggleIpcEnabled = toggleIpcEnabled;
        window.toggleIndirectsEnabled = toggleIndirectsEnabled;
        window.adjustIndirectsDivisor = adjustIndirectsDivisor;
        window.toggleKieLaborSection = toggleKieLaborSection;
        window.toggleSubsSection = toggleSubsSection;
        window.toggleExpensesSection = toggleExpensesSection;
        window.applyUnifiedEstimate = applyUnifiedEstimate;
        window.resetUnifiedEstimate = resetUnifiedEstimate;
        window.toggleMHColumns = toggleMHColumns;
        window.handleBenchmarkDatasetChange = handleBenchmarkDatasetChange;
        window.selectAllBenchmarks = selectAllBenchmarks;
        window.handleDillonFileUpload = handleDillonFileUpload;

        // Initialize header help tooltips (click to toggle)
        function initHeaderHelpTooltips() {
            // Toggle tooltip on click
            document.addEventListener('click', function(e) {
                if (e.target.classList.contains('header-help')) {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    const isActive = e.target.classList.contains('active');
                    
                    // Close all other tooltips
                    document.querySelectorAll('.header-help.active').forEach(el => {
                        el.classList.remove('active');
                    });
                    
                    // Toggle this one
                    if (!isActive) {
                        e.target.classList.add('active');
                    }
                } else {
                    // Close all tooltips if clicking outside
                    document.querySelectorAll('.header-help.active').forEach(el => {
                        el.classList.remove('active');
                    });
                }
            });
        }

        // Initialize
        document.addEventListener('DOMContentLoaded', async () => {
            initDisciplines();
            initHeaderHelpTooltips();
            
            // Load benchmark data from JSON files before initializing MH estimator
            updateStatus('LOADING BENCHMARKS...');
            try {
                await loadBenchmarkData();
                console.log('Benchmark data loaded from JSON files');
            } catch (error) {
                console.warn('Failed to load benchmark data from JSON files, using fallback:', error);
            }
            
            // Load discipline resource rates
            try {
                await loadDisciplineResources();
                console.log('Discipline resources loaded');
            } catch (error) {
                console.warn('Failed to load discipline resources:', error);
            }
            
            initMHEstimator();
            initUnifiedEstimator(); // Initialize unified table
            buildBudgetTable();
            updateStatus('READY');
            
            // Check for saved data after a brief delay to let UI initialize
            setTimeout(checkForSavedData, 500);

            // Force all benchmarks to be selected after localStorage loads; use curve when quantity > 0
            // ESDC and TSCD are excluded: their selection comes from JSON "Applicable Job" = "Yes" or from Excel ESDC/TSCD tab upload
            setTimeout(() => {
                for (const discId of Object.keys(mhEstimateState.disciplines)) {
                    if (discId === 'esdc' || discId === 'tscd') continue;

                    const state = mhEstimateState.disciplines[discId];
                    if (!state.active) continue;

                    const benchmarks = getBenchmarkDataSync(discId);
                    if (!benchmarks || !benchmarks.projects) continue;

                    benchmarks.projects.forEach(p => p.applicable = true);
                    state.selectedProjects = benchmarks.projects;

                    const qty = state.quantity || 0;
                    const config = DISCIPLINE_CONFIG[discId];
                    const unit = config?.unit || benchmarks?.eqty_metric?.uom || 'EA';

                    if (qty > 0 && discId !== 'esdc' && discId !== 'tscd' && benchmarks.projects.length >= 2) {
                        // Use curve so All Rate and Selected Rate depend on quantity
                        const qtyInput = document.getElementById(`unified-qty-${discId}`);
                        if (qtyInput && typeof updateUnifiedQuantity === 'function') {
                            qtyInput.value = qty.toLocaleString('en-US');
                            updateUnifiedQuantity(discId);
                        } else {
                            const result = estimateMH(discId, qty, state.selectedProjects);
                            state.rate = result.rate;
                            state.allRate = result.allRate != null ? result.allRate : BenchmarkStats.calculateRateStats(benchmarks.projects).mean;
                            state.mh = result.mh;
                            const rateElem = document.getElementById(`unified-rate-${discId}`);
                            const allRateEl = document.getElementById(`unified-rate-all-${discId}`);
                            if (rateElem) rateElem.textContent = formatRate(state.rate, unit);
                            if (allRateEl && state.allRate != null) allRateEl.textContent = formatRate(state.allRate, unit);
                        }
                    } else {
                        const meanRate = BenchmarkStats.calculateRateStats(benchmarks.projects).mean;
                        state.rate = meanRate;
                        state.allRate = meanRate;
                        const rateElem = document.getElementById(`unified-rate-${discId}`);
                        const allRateEl = document.getElementById(`unified-rate-all-${discId}`);
                        if (rateElem) rateElem.textContent = formatRate(meanRate, unit);
                        if (allRateEl) allRateEl.textContent = formatRate(meanRate, unit);
                    }
                }
                updateUnifiedSummary();
            }, 1000); // Run after localStorage check (500ms) + 500ms buffer

            // Set up input listeners for autosave
            setupAutosaveListeners();
        });

        /**
         * Sets up event listeners for autosave on all inputs
         */
        function setupAutosaveListeners() {
            // Listen for input changes on form fields
            document.querySelectorAll('input, select, textarea').forEach(el => {
                el.addEventListener('change', triggerAutosave);
                el.addEventListener('input', triggerAutosave);
            });
            
            // Listen for discipline grid clicks
            const discGrid = document.getElementById('disciplines-grid');
            if (discGrid) {
                discGrid.addEventListener('click', () => setTimeout(triggerAutosave, 100));
            }
        }

        /**
         * Updates the status indicator in the terminal header
         * @param {string} text - Status text to display
         */
        function updateStatus(text) {
            document.getElementById('status-text').textContent = text;
        }

        /**
         * Initializes the discipline selection grid with all available disciplines
         */
        function initDisciplines() {
            const grid = document.getElementById('disciplines-grid');
            grid.innerHTML = allDisciplines.map(d => 
                `<div class="disc-item ${d.selected ? 'selected' : ''}" onclick="toggleDisc(this)" data-name="${d.name}">${d.name}</div>`
            ).join('');
            updateSelectedCount();
        }

        /**
         * Toggles the selection state of a discipline item
         * @param {HTMLElement} el - The discipline element to toggle
         */
        function toggleDisc(el) {
            el.classList.toggle('selected');
            updateSelectedCount();
        }

        /**
         * Selects all disciplines in the grid
         */
        function selectAllDisciplines() {
            document.querySelectorAll('.disc-item').forEach(el => el.classList.add('selected'));
            updateSelectedCount();
        }

        /**
         * Updates the selected discipline count display
         */
        function updateSelectedCount() {
            const count = document.querySelectorAll('.disc-item.selected').length;
            document.getElementById('selected-count').textContent = count;
        }

        /**
         * Adds a custom discipline to the grid from the input field
         */
        function addCustomDiscipline() {
            const input = document.getElementById('custom-discipline');
            const name = input.value.trim();
            if (name) {
                const grid = document.getElementById('disciplines-grid');
                grid.innerHTML += `<div class="disc-item selected" onclick="toggleDisc(this)" data-name="${name}">${name}</div>`;
                exampleBudgets[name] = 100000;
                input.value = '';
                updateSelectedCount();
            }
        }

        /**
         * Adds a phase to the phases input if not already present
         * @param {string} phase - Phase name to add
         */
        function addQuickPhase(phase) {
            const input = document.getElementById('phases-input');
            const phases = input.value.split(',').map(p => p.trim()).filter(p => p);
            if (!phases.includes(phase)) {
                phases.push(phase);
                input.value = phases.join(', ');
            }
        }

        /**
         * Adds a package to the packages input if not already present
         * @param {string} pkg - Package name to add
         */
        function addQuickPackage(pkg) {
            const input = document.getElementById('packages-input');
            const packages = input.value.split(',').map(p => p.trim()).filter(p => p);
            if (!packages.includes(pkg)) {
                packages.push(pkg);
                input.value = packages.join(', ');
            }
        }

        /**
         * Updates the progress bar visual state based on current step
         * Tab order: BENCHMARKING(4), PHASES(1), DISCIPLINES(2), PACKAGES(3), CLAIMING(5), SCHEDULE(6), PROJECT(7)
         */
        function updateProgress() {
            // Map tab index to step number (visual order differs from internal step numbers)
            const tabToStep = [4, 1, 2, 3, 5, 6, 7];
            
            document.querySelectorAll('.progress-step').forEach((el, i) => {
                el.classList.remove('active', 'completed');
                const tabStep = tabToStep[i];
                if (tabStep === currentStep) el.classList.add('active');
            });
        }

        /**
         * Shows the specified wizard step and updates navigation buttons
         * @param {number} step - Step number (1-7)
         */
        function showStep(step) {
            document.querySelectorAll('.step-content').forEach(el => el.classList.add('hidden'));
            document.getElementById(`step${step}`).classList.remove('hidden');
            
            // Visual step order: BENCHMARKING(4), PHASES(1), DISCIPLINES(2), PACKAGES(3), CLAIMING(5), SCHEDULE(6), PROJECT(7)
            const visualOrder = [4, 1, 2, 3, 5, 6, 7];
            const visualIndex = visualOrder.indexOf(step);
            
            document.getElementById('prev-btn').classList.toggle('hidden', visualIndex === 0);
            document.getElementById('next-btn').classList.toggle('hidden', visualIndex === 6);
            document.getElementById('generate-btn').classList.toggle('hidden', step !== 7);
            
            // Load project info when showing step 7
            if (step === 7) {
                loadProjectInfo();
            }
            
            updateProgress();
            updateStatus(`STEP ${visualIndex + 1}/7`);
        }

        /**
         * Navigates to any step in the wizard
         * @param {number} step - Step number to navigate to
         */
        function goToStep(step) {
            if (step !== currentStep) {
                saveCurrentStep();
                currentStep = step;
                showStep(step);

                // Initialize step-specific content
                if (step === 4) {
                    buildBudgetTable();
                    updateUnifiedSummary(); // Update totals when showing benchmarking step
                }
                if (step === 5) buildClaimingTable();
                if (step === 6) buildDatesTable();
                if (step === 7) loadProjectInfo();
            }
        }

        /**
         * Saves data from the current wizard step to projectData object
         */
        function saveCurrentStep() {
            switch(currentStep) {
                case 1:
                    projectData.phases = document.getElementById('phases-input').value.split(',').map(p => p.trim()).filter(p => p);
                    break;
                case 2:
                    projectData.disciplines = Array.from(document.querySelectorAll('.disc-item.selected')).map(el => el.dataset.name);
                    break;
                case 3:
                    projectData.packages = document.getElementById('packages-input').value.split(',').map(p => p.trim()).filter(p => p);
                    break;
                case 4:
                    document.querySelectorAll('.budget-input').forEach(input => {
                        // Remove commas before parsing
                        const value = parseFloat(input.value.replace(/,/g, '')) || 0;
                        projectData.budgets[input.dataset.disc] = value;
                    });
                    break;
                case 5:
                    document.querySelectorAll('.claiming-input').forEach(input => {
                        projectData.claiming[input.dataset.key] = parseFloat(input.value) || 0;
                    });
                    break;
                case 6:
                    document.querySelectorAll('.date-start').forEach(input => {
                        const key = input.dataset.key;
                        const endInput = document.querySelector(`.date-end[data-key="${key}"]`);
                        projectData.dates[key] = { start: input.value, end: endInput.value };
                    });
                    break;
                case 7:
                    saveProjectInfo();
                    break;
            }
            
            // Trigger autosave after any step save
            triggerAutosave();
        }
        
        /**
         * Saves project information from Step 7 to projectData
         */
        function saveProjectInfo() {
            projectData.projectInfo.projectName = document.getElementById('project-name')?.value || '';
            projectData.projectInfo.projectLocation = document.getElementById('project-location')?.value || '';
            projectData.projectInfo.leadDistrict = document.getElementById('lead-district')?.value || '';
            projectData.projectInfo.partneringDistricts = document.getElementById('partnering-districts')?.value || '';
            projectData.projectInfo.kieNonSpPercentage = document.getElementById('kie-nonsp-percentage')?.value || '';
            projectData.projectInfo.kegEntity = document.getElementById('keg-entity')?.value || '';
            projectData.projectInfo.technicalProposalDue = document.getElementById('technical-proposal-due')?.value || '';
            projectData.projectInfo.priceProposalDue = document.getElementById('price-proposal-due')?.value || '';
            projectData.projectInfo.interviewDate = document.getElementById('interview-date')?.value || '';
            projectData.projectInfo.contractAward = document.getElementById('contract-award')?.value || '';
            projectData.projectInfo.noticeToProceed = document.getElementById('notice-to-proceed')?.value || '';
            projectData.projectInfo.stipendAmount = document.getElementById('stipend-amount')?.value || '';
            projectData.projectInfo.ownerContractType = document.getElementById('owner-contract-type')?.value || '';
            projectData.projectInfo.evaluationCriteria = document.getElementById('evaluation-criteria')?.value || '';
            projectData.projectInfo.dbeGoals = document.getElementById('dbe-goals')?.value || '';
            projectData.projectOrganization = document.getElementById('project-organization')?.value || '';
            
            triggerAutosave();
        }
        
        /**
         * Loads project information into Step 7 form fields
         */
        function loadProjectInfo() {
            const info = projectData.projectInfo || {};
            
            if (document.getElementById('project-name')) {
                document.getElementById('project-name').value = info.projectName || '';
                document.getElementById('project-location').value = info.projectLocation || '';
                document.getElementById('lead-district').value = info.leadDistrict || '';
                document.getElementById('partnering-districts').value = info.partneringDistricts || '';
                document.getElementById('kie-nonsp-percentage').value = info.kieNonSpPercentage || '';
                document.getElementById('keg-entity').value = info.kegEntity || '';
                document.getElementById('technical-proposal-due').value = info.technicalProposalDue || '';
                document.getElementById('price-proposal-due').value = info.priceProposalDue || '';
                document.getElementById('interview-date').value = info.interviewDate || '';
                document.getElementById('contract-award').value = info.contractAward || '';
                document.getElementById('notice-to-proceed').value = info.noticeToProceed || '';
                document.getElementById('stipend-amount').value = info.stipendAmount || '';
                document.getElementById('owner-contract-type').value = info.ownerContractType || '';
                document.getElementById('evaluation-criteria').value = info.evaluationCriteria || '';
                document.getElementById('dbe-goals').value = info.dbeGoals || '';
                document.getElementById('project-organization').value = projectData.projectOrganization || '';
            }
            
            // Show RFP extracted section if we have RFP data
            const rfpSection = document.getElementById('rfp-extracted-info');
            if (rfpSection && (info.evaluationCriteria || info.dbeGoals)) {
                rfpSection.classList.remove('hidden');
            }
        }

        /**
         * Validates the current wizard step before allowing progression
         * @returns {boolean} True if validation passes, false otherwise
         */
        function validate() {
            switch(currentStep) {
                case 1:
                    if (!document.getElementById('phases-input').value.trim()) {
                        alert('Enter at least one phase.');
                        return false;
                    }
                    break;
                case 2:
                    if (document.querySelectorAll('.disc-item.selected').length === 0) {
                        alert('Select at least one discipline.');
                        return false;
                    }
                    break;
                case 3:
                    if (!document.getElementById('packages-input').value.trim()) {
                        alert('Enter at least one package.');
                        return false;
                    }
                    break;
            }
            return true;
        }

        /**
         * Advances to the next wizard step after validation
         */
        function nextStep() {
            if (!validate()) return;
            saveCurrentStep();
            
            // Visual step order: BENCHMARKING(4), PHASES(1), DISCIPLINES(2), PACKAGES(3), CLAIMING(5), SCHEDULE(6), PROJECT(7)
            const visualOrder = [4, 1, 2, 3, 5, 6, 7];
            const currentVisualIndex = visualOrder.indexOf(currentStep);
            
            if (currentVisualIndex < visualOrder.length - 1) {
                currentStep = visualOrder[currentVisualIndex + 1];
                showStep(currentStep);
                
                if (currentStep === 4) {
                    buildBudgetTable();
                    updateUnifiedSummary(); // Update totals when navigating to benchmarking step
                    // Re-apply RFP quantities to MH Estimator if RFP data was imported
                    if (rfpState.extractedData && rfpState.quantities) {
                        reapplyRfpQuantitiesToMHEstimator();
                    }
                }
                if (currentStep === 5) buildClaimingTable();
                if (currentStep === 7) loadProjectInfo();
                if (currentStep === 6) buildDatesTable();
            }
        }

        /**
         * Returns to the previous wizard step or from results to wizard
         */
        function prevStep() {
            // Check if we're on the results page
            const resultsVisible = !document.getElementById('results-section').classList.contains('hidden');
            
            if (resultsVisible) {
                // Return from results to wizard (step 7)
                editWBS();
                currentStep = 7;
                showStep(7);
                return;
            }
            
            saveCurrentStep();
            
            // Visual step order: BENCHMARKING(4), PHASES(1), DISCIPLINES(2), PACKAGES(3), CLAIMING(5), SCHEDULE(6), PROJECT(7)
            const visualOrder = [4, 1, 2, 3, 5, 6, 7];
            const currentVisualIndex = visualOrder.indexOf(currentStep);
            
            if (currentVisualIndex > 0) {
                currentStep = visualOrder[currentVisualIndex - 1];
                showStep(currentStep);

                // Initialize step-specific content
                if (currentStep === 4) {
                    buildBudgetTable();
                    updateUnifiedSummary(); // Update totals when navigating back to benchmarking step
                }
                if (currentStep === 5) buildClaimingTable();
                if (currentStep === 6) buildDatesTable();
                if (currentStep === 7) loadProjectInfo();
            }
        }

        /**
         * Builds the budget input table for Step 4
         * Generates rows for each selected discipline with budget inputs and industry indicators
         */
        function buildBudgetTable() {
            const table = document.getElementById('budget-table');
            const disciplineOrder = [
                'roadway', 'drainage', 'mot', 'traffic', 'utilities',
                'retainingWalls', 'noiseWalls',
                'bridgesPCGirder', 'bridgesSteel', 'bridgesRehab',
                'miscStructures', 'geotechnical',
                'systems', 'track', 'environmental',
                'digitalDelivery'
            ];
            const mhDisciplines = disciplineOrder
                .map(id => DISCIPLINE_CONFIG[id]?.name)
                .filter(Boolean);
            const mhDisciplineSet = new Set(mhDisciplines);
            const additionalDisciplines = projectData.disciplines.filter(
                disc => !mhDisciplines.includes(disc)
            );
            const disciplinesForTable = [...mhDisciplines, ...additionalDisciplines];

            if (!table) {
                return;
            }
            let html = `
                <thead>
                    <tr>
                        <th>DISCIPLINE</th>
                        <th style="text-align: right; width: 200px;">TOTAL COST</th>
                    </tr>
                </thead>
                <tbody>
            `;

            if (disciplinesForTable.length === 0) {
                html += `
                    <tr>
                        <td colspan="2" style="text-align: center; color: #888;">No disciplines yet</td>
                    </tr>
                `;
            }

            disciplinesForTable.forEach(disc => {
                const isMhDiscipline = mhDisciplineSet.has(disc);
                const budget = projectData.budgets[disc] !== undefined
                    ? projectData.budgets[disc]
                    : (isMhDiscipline ? 0 : (exampleBudgets[disc] || 100000));
                const formattedBudget = Math.round(budget).toLocaleString('en-US', {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0
                });
                const readOnly = isMhDiscipline ? 'readonly' : '';
                html += `
                    <tr data-disc="${disc}">
                        <td>${disc}</td>
                        <td>
                            <input type="text" class="table-input budget-input" data-disc="${disc}" value="${formattedBudget}" ${readOnly}>
                        </td>
                    </tr>
                `;
            });

            const summaryRows = ['Indirects', 'IPC', 'Contingency', 'Escalation'];
            summaryRows.forEach(label => {
                html += `
                    <tr class="budget-summary-row" data-summary="${label}">
                        <td>${label}</td>
                        <td>
                            <input type="text" class="table-input budget-input" value="" readonly>
                        </td>
                    </tr>
                `;
            });

            html += '</tbody>';
            table.innerHTML = html;

            // Add input listeners with manual edit tracking and formatting
            document.querySelectorAll('.budget-input').forEach(input => {
                // Validate input to only allow numbers and commas
                input.addEventListener('keydown', function(event) {
                    const allowedKeys = ['Backspace', 'Delete', 'Tab', 'Escape', 'Enter', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];
                    if (allowedKeys.includes(event.key)) {
                        return;
                    }
                    if (event.ctrlKey || event.metaKey) {
                        if (['a', 'c', 'v', 'x'].includes(event.key.toLowerCase())) {
                            return;
                        }
                    }
                    if (!/[\d,]/.test(event.key)) {
                        event.preventDefault();
                    }
                });
                
                // Format on blur
                input.addEventListener('blur', function() {
                    const value = parseFloat(this.value.replace(/,/g, '')) || 0;
                    if (value > 0) {
                        this.value = Math.round(value).toLocaleString('en-US', {
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 0
                        });
                    } else {
                        this.value = '';
                    }
                });
                
                // Remove formatting on focus for easier editing
                input.addEventListener('focus', function() {
                    const value = parseFloat(this.value.replace(/,/g, '')) || 0;
                    this.value = value > 0 ? value.toString() : '';
                });
                
                // Track manual edits and update total
                input.addEventListener('input', function() {
                    // Mark as manually edited
                    projectData.calculator.manualEdits[this.dataset.disc] = true;
                    updateTotalBudget();
                });
            });

            // Initialize calculator if first time
            if (!projectData.calculator.isCalculated) {
                initCalculator();
            } else {
                // Re-populate calculator values
                const costInput = document.getElementById('calc-construction-cost');
                const cost = projectData.calculator.totalConstructionCost || 0;
                costInput.value = cost > 0 ? Math.round(cost).toLocaleString('en-US', {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0
                }) : '';
                document.getElementById('calc-design-fee-pct').value = projectData.calculator.designFeePercent;
                document.getElementById('calc-project-type').value = projectData.calculator.projectType;
                
                // Re-initialize calculator to set up event listeners
                initCalculator();
                updateIndustryIndicators();
            }

            updateTotalBudget();
        }

        /**
         * Updates the total budget display and triggers industry indicator updates if needed
         */
        function updateTotalBudget() {
            let total = 0;
            document.querySelectorAll('.budget-input').forEach(input => {
                // Remove commas before parsing
                const value = parseFloat(input.value.replace(/,/g, '')) || 0;
                total += value;
            });
            document.getElementById('total-budget').textContent = formatCurrency(total);

            // Update indicators if calculation was performed
            if (projectData.calculator.isCalculated) {
                updateIndustryIndicators();
            }
        }

        // Calculator Functions
        
        /**
         * Toggles the calculator section expand/collapse state
         */
        function toggleCalculator() {
            const body = document.getElementById('calculator-body');
            const header = document.querySelector('.calculator-header span:first-child');

            if (body.classList.contains('collapsed')) {
                body.classList.remove('collapsed');
                header.textContent = '▼ COST ESTIMATOR';
            } else {
                body.classList.add('collapsed');
                header.textContent = '► COST ESTIMATOR';
            }
        }

        function showComplexityOverrides() {
            const overrideSection = document.getElementById('complexity-overrides');

            if (overrideSection.classList.contains('hidden')) {
                buildComplexityOverrideGrid();
                overrideSection.classList.remove('hidden');
            } else {
                overrideSection.classList.add('hidden');
            }
        }

        function buildComplexityOverrideGrid() {
            const grid = document.getElementById('complexity-grid');
            const projectType = document.getElementById('calc-project-type').value;

            let html = '';
            projectData.disciplines.forEach(disc => {
                const autoComplexity = projectComplexityMap[projectType][disc] || 'Medium';
                const savedOverride = projectData.calculator.complexityOverrides[disc];
                const currentValue = savedOverride || autoComplexity;

                html += `
                    <div class="complexity-item">
                        <label>${disc}</label>
                        <select class="complexity-override" data-disc="${disc}" onchange="saveComplexityOverride(this)">
                            <option value="Low" ${currentValue === 'Low' ? 'selected' : ''}>Low</option>
                            <option value="Medium" ${currentValue === 'Medium' ? 'selected' : ''}>Medium</option>
                            <option value="High" ${currentValue === 'High' ? 'selected' : ''}>High</option>
                        </select>
                        ${savedOverride ? '<span style="color: #ffd700;">*</span>' : ''}
                    </div>
                `;
            });

            grid.innerHTML = html;
        }

        function saveComplexityOverride(selectEl) {
            const disc = selectEl.dataset.disc;
            const value = selectEl.value;
            const projectType = document.getElementById('calc-project-type').value;
            const autoValue = projectComplexityMap[projectType][disc];

            // Only save if different from auto-assigned
            if (value !== autoValue) {
                projectData.calculator.complexityOverrides[disc] = value;
            } else {
                delete projectData.calculator.complexityOverrides[disc];
            }
        }

        function updateComplexityDefaults() {
            // Clear overrides when project type changes
            projectData.calculator.complexityOverrides = {};

            // Rebuild override grid if visible
            const overrideSection = document.getElementById('complexity-overrides');
            if (!overrideSection.classList.contains('hidden')) {
                buildComplexityOverrideGrid();
            }

            // Recalculate total design fee
            updateCalculatorTotal();
        }

        /**
         * Calculates and displays the total design fee based on construction cost and design fee percentage
         */
        function updateCalculatorTotal() {
            const costInput = document.getElementById('calc-construction-cost');
            // Remove commas before parsing
            const constructionCost = parseFloat(costInput.value.replace(/,/g, '')) || 0;
            const designFeePct = parseFloat(document.getElementById('calc-design-fee-pct').value) || 0;
            const totalFee = constructionCost * (designFeePct / 100);

            document.getElementById('calc-total-fee').textContent = formatCurrency(totalFee);
            projectData.calculator.totalConstructionCost = constructionCost;
            projectData.calculator.designFeePercent = designFeePct;
            projectData.calculator.totalDesignFee = totalFee;
        }

        /**
         * Formats construction cost input with commas on blur
         */
        function formatConstructionCostInput(event) {
            const input = event ? event.target : document.getElementById('calc-construction-cost');
            const value = parseFloat(input.value.replace(/,/g, '')) || 0;
            if (value > 0) {
                input.value = Math.round(value).toLocaleString('en-US', {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0
                });
            } else {
                input.value = '';
            }
        }

        /**
         * Removes formatting from construction cost input on focus for easier editing
         */
        function unformatConstructionCostInput(event) {
            const input = event ? event.target : document.getElementById('calc-construction-cost');
            const value = parseFloat(input.value.replace(/,/g, '')) || 0;
            input.value = value > 0 ? value.toString() : '';
        }

        /**
         * Validates construction cost input to only allow numbers and commas
         */
        function validateConstructionCostInput(event) {
            const input = event.target;
            // Allow: numbers, commas, backspace, delete, tab, escape, enter, and arrow keys
            const allowedKeys = ['Backspace', 'Delete', 'Tab', 'Escape', 'Enter', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];
            if (allowedKeys.includes(event.key)) {
                return;
            }
            // Allow Ctrl/Cmd + A, C, V, X
            if (event.ctrlKey || event.metaKey) {
                if (['a', 'c', 'v', 'x'].includes(event.key.toLowerCase())) {
                    return;
                }
            }
            // Only allow numbers and commas
            if (!/[\d,]/.test(event.key)) {
                event.preventDefault();
            }
        }

        /**
         * Initializes calculator event listeners for real-time total updates
         */
        function initCalculator() {
            const costInput = document.getElementById('calc-construction-cost');
            
            // Add event listeners (check if already initialized to prevent duplicates)
            if (!costInput.dataset.initialized) {
                costInput.addEventListener('input', () => {
                    updateCalculatorTotal();
                });
                costInput.addEventListener('blur', formatConstructionCostInput);
                costInput.addEventListener('focus', unformatConstructionCostInput);
                costInput.addEventListener('keydown', validateConstructionCostInput);
                costInput.dataset.initialized = 'true';
            }
            
            // Format initial value if present
            if (costInput.value && parseFloat(costInput.value.replace(/,/g, '')) > 0) {
                const value = parseFloat(costInput.value.replace(/,/g, '')) || 0;
                if (value > 0) {
                    costInput.value = Math.round(value).toLocaleString('en-US', {
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 0
                    });
                }
            }
            
            const feeInput = document.getElementById('calc-design-fee-pct');
            if (!feeInput.dataset.initialized) {
                feeInput.addEventListener('input', updateCalculatorTotal);
                feeInput.dataset.initialized = 'true';
            }
            
            updateCalculatorTotal();
        }

        /**
         * Validates calculator inputs before budget calculation
         * @param {number} constructionCost - Total construction cost
         * @param {number} designFeePct - Design fee percentage
         * @returns {boolean} True if validation passes
         */
        function validateCalculatorInputs(constructionCost, designFeePct) {
            if (!constructionCost || constructionCost <= 0) {
                alert('Enter a valid construction cost.');
                return false;
            }
            if (!designFeePct || designFeePct <= 0 || designFeePct > 30) {
                alert('Design fee must be between 1% and 30%.');
                return false;
            }
            return true;
        }

        /**
         * Calculates raw industry distribution percentages for selected disciplines
         * @param {string} projectType - Project type (Bridge, Highway/Roadway, Drainage/Utilities)
         * @param {Array<string>} disciplines - Selected disciplines
         * @returns {{percentages: Object, total: number}} Raw percentages and total
         */
        function calculateRawPercentages(projectType, disciplines) {
            const rawPercentages = {};
            let totalRawPercentage = 0;

            disciplines.forEach(discipline => {
                // Get complexity (override or auto-assigned)
                const complexity = projectData.calculator.complexityOverrides[discipline] ||
                    projectComplexityMap[projectType][discipline] ||
                    'Medium';

                // Get industry percentage
                const distribution = industryDistribution[projectType];
                const percentage = distribution[discipline] ? distribution[discipline][complexity] : 5;

                rawPercentages[discipline] = percentage;
                totalRawPercentage += percentage;
            });

            return { percentages: rawPercentages, total: totalRawPercentage };
        }

        /**
         * Normalizes raw percentages to sum to 100% and calculates budgets
         * @param {Object} rawPercentages - Raw percentage values per discipline
         * @param {number} totalRawPercentage - Sum of raw percentages
         * @param {number} totalDesignFee - Total design fee amount
         * @param {Array<string>} disciplines - Selected disciplines
         * @returns {Object} Normalized budget amounts per discipline
         */
        function normalizeBudgets(rawPercentages, totalRawPercentage, totalDesignFee, disciplines) {
            const normalizedBudgets = {};
            disciplines.forEach(discipline => {
                const normalizedPct = (rawPercentages[discipline] / totalRawPercentage) * 100;
                normalizedBudgets[discipline] = totalDesignFee * (normalizedPct / 100);
            });
            return normalizedBudgets;
        }

        /**
         * Applies calculated budgets to the budget table inputs
         * @param {Object} normalizedBudgets - Budget amounts per discipline
         * @param {Array<string>} disciplines - Selected disciplines
         */
        function applyBudgetsToTable(normalizedBudgets, disciplines) {
            disciplines.forEach(discipline => {
                const input = document.querySelector(`.budget-input[data-disc="${discipline}"]`);
                if (input && !projectData.calculator.manualEdits[discipline]) {
                    const rounded = Math.round(normalizedBudgets[discipline]);
                    // Format with commas
                    input.value = rounded.toLocaleString('en-US', {
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 0
                    });
                    projectData.budgets[discipline] = normalizedBudgets[discipline];
                }
            });
        }

        /**
         * Updates calculator UI after successful calculation
         * @param {string} projectType - Project type used in calculation
         */
        function updateCalculatorUI(projectType) {
            projectData.calculator.isCalculated = true;
            projectData.calculator.projectType = projectType;

            // Collapse calculator and update status
            document.getElementById('calculator-body').classList.add('collapsed');
            document.querySelector('.calculator-header span:first-child').textContent = '► COST ESTIMATOR';
            document.getElementById('calculator-status').textContent = 'Estimates applied • Click to edit';
            document.getElementById('calculator-status').style.color = '#00ff00';

            updateTotalBudget();
            updateIndustryIndicators();
            updateStatus('BUDGETS CALCULATED');
        }

        /**
         * Main function to calculate discipline budgets based on construction cost and industry standards
         * Validates inputs, calculates normalized budgets, and updates the UI
         */
        function calculateBudgets() {
            const costInput = document.getElementById('calc-construction-cost');
            // Remove commas before parsing
            const constructionCost = parseFloat(costInput.value.replace(/,/g, ''));
            const designFeePct = parseFloat(document.getElementById('calc-design-fee-pct').value);
            const projectType = document.getElementById('calc-project-type').value;

            // Validate inputs
            if (!validateCalculatorInputs(constructionCost, designFeePct)) {
                return;
            }

            const totalDesignFee = constructionCost * (designFeePct / 100);
            const selectedDisciplines = projectData.disciplines;

            // Calculate raw percentages
            const { percentages: rawPercentages, total: totalRawPercentage } = 
                calculateRawPercentages(projectType, selectedDisciplines);

            // Normalize and calculate budgets
            const normalizedBudgets = normalizeBudgets(
                rawPercentages, 
                totalRawPercentage, 
                totalDesignFee, 
                selectedDisciplines
            );

            // Apply to table
            applyBudgetsToTable(normalizedBudgets, selectedDisciplines);

            // Update UI
            updateCalculatorUI(projectType);
        }

        function updateIndustryIndicators() {
            if (!projectData.calculator.isCalculated) return;

            const totalBudget = Object.values(projectData.budgets).reduce((sum, val) => sum + val, 0);
            const projectType = projectData.calculator.projectType;

            projectData.disciplines.forEach(disc => {
                const budget = projectData.budgets[disc] || 0;
                const ratio = budget / totalBudget;

                // Get industry benchmark (if exists)
                const benchmark = industryBenchmarks[projectType] && industryBenchmarks[projectType][disc];

                if (!benchmark) {
                    // No benchmark available, use neutral indicator
                    const cell = document.querySelector(`tr[data-disc="${disc}"] .indicator-cell`);
                    if (cell) cell.innerHTML = '<span class="industry-indicator within">•</span>';
                    return;
                }

                // Determine variance
                let indicator = '';
                let variance = 0;

                if (ratio > benchmark.max) {
                    variance = ((ratio - benchmark.typical) / benchmark.typical * 100).toFixed(1);
                    indicator = `
                        <span class="industry-indicator above tooltip">↑
                            <span class="tooltiptext">
                                Above industry range<br>
                                Your ratio: ${(ratio * 100).toFixed(1)}%<br>
                                Industry range: ${(benchmark.min * 100).toFixed(1)}% - ${(benchmark.max * 100).toFixed(1)}%<br>
                                Variance: +${variance}%
                            </span>
                        </span>
                    `;
                } else if (ratio < benchmark.min) {
                    variance = ((benchmark.typical - ratio) / benchmark.typical * 100).toFixed(1);
                    indicator = `
                        <span class="industry-indicator below tooltip">↓
                            <span class="tooltiptext">
                                Below industry range<br>
                                Your ratio: ${(ratio * 100).toFixed(1)}%<br>
                                Industry range: ${(benchmark.min * 100).toFixed(1)}% - ${(benchmark.max * 100).toFixed(1)}%<br>
                                Variance: -${variance}%
                            </span>
                        </span>
                    `;
                } else {
                    indicator = `
                        <span class="industry-indicator within tooltip">•
                            <span class="tooltiptext">
                                Within industry range<br>
                                Your ratio: ${(ratio * 100).toFixed(1)}%<br>
                                Industry range: ${(benchmark.min * 100).toFixed(1)}% - ${(benchmark.max * 100).toFixed(1)}%
                            </span>
                        </span>
                    `;
                }

                const cell = document.querySelector(`tr[data-disc="${disc}"] .indicator-cell`);
                if (cell) cell.innerHTML = indicator;
            });
        }

        /**
         * Builds the claiming percentage table for Step 5
         * Generates a grid of inputs for each discipline-package combination
         */
        function buildClaimingTable() {
            const table = document.getElementById('claiming-table');
            const numPkgs = projectData.packages.length;
            
            let html = `
                <thead>
                    <tr>
                        <th>DISCIPLINE</th>
                        ${projectData.packages.map(p => `<th style="text-align: center;">${p}</th>`).join('')}
                        <th style="text-align: center;">TOTAL</th>
                    </tr>
                </thead>
                <tbody>
            `;
            
            projectData.disciplines.forEach(disc => {
                html += `<tr><td>${disc}</td>`;
                
                projectData.packages.forEach((pkg, i) => {
                    const key = `${disc}-${pkg}`;
                    const defaultVal = defaultClaiming[i] || Math.floor(100 / numPkgs);
                    const val = projectData.claiming[key] !== undefined ? projectData.claiming[key] : defaultVal;
                    
                    html += `
                        <td style="text-align: center;">
                            <input type="number" class="table-input claiming-input" style="text-align: center; width: 60px;" 
                                data-key="${key}" data-disc="${disc}" value="${val}" min="0" max="100">%
                        </td>
                    `;
                });
                
                html += `<td class="claiming-total" data-disc="${disc}" style="text-align: center;">0%</td></tr>`;
            });
            
            html += '</tbody>';
            table.innerHTML = html;
            
            document.querySelectorAll('.claiming-input').forEach(input => {
                input.addEventListener('input', updateClaimingTotals);
            });
            updateClaimingTotals();
        }

        /**
         * Updates claiming percentage totals for each discipline and validates they sum to 100%
         */
        function updateClaimingTotals() {
            projectData.disciplines.forEach(disc => {
                let total = 0;
                document.querySelectorAll(`.claiming-input[data-disc="${disc}"]`).forEach(input => {
                    total += parseFloat(input.value) || 0;
                });

                const cell = document.querySelector(`.claiming-total[data-disc="${disc}"]`);
                cell.textContent = total + '%';
                cell.className = `claiming-total ${total === 100 ? 'status-ok' : 'status-err'}`;
            });
        }

        // ============ CLAIMING PRESET FUNCTIONS ============

        // Normalize array to sum to 100%
        function normalizeToHundred(arr) {
            const sum = arr.reduce((a, b) => a + b, 0);
            if (sum === 0) return arr;

            const normalized = arr.map(val => (val / sum) * 100);
            const rounded = normalized.map(val => Math.round(val));

            // Adjust for rounding errors
            const roundedSum = rounded.reduce((a, b) => a + b, 0);
            if (roundedSum !== 100) {
                const diff = 100 - roundedSum;
                const maxIndex = rounded.indexOf(Math.max(...rounded));
                rounded[maxIndex] += diff;
            }

            return rounded;
        }

        // Linear/Even distribution
        function distributeEvenly(count) {
            if (count <= 0) return [];
            const base = Math.floor(100 / count);
            const remainder = 100 - (base * count);
            const result = new Array(count).fill(base);
            result[result.length - 1] += remainder;
            return result;
        }

        // Front-Loaded (descending) pattern
        function createDescendingPattern(count) {
            if (count === 1) return [100];
            if (count === 2) return [60, 40];

            const maxVal = 30;
            const minVal = 10;
            const step = (maxVal - minVal) / (count - 1);

            const result = [];
            for (let i = 0; i < count; i++) {
                result.push(maxVal - (step * i));
            }

            return normalizeToHundred(result);
        }

        // Back-Loaded (ascending) pattern
        function createAscendingPattern(count) {
            if (count === 1) return [100];
            if (count === 2) return [40, 60];

            const minVal = 10;
            const maxVal = 30;
            const step = (maxVal - minVal) / (count - 1);

            const result = [];
            for (let i = 0; i < count; i++) {
                result.push(minVal + (step * i));
            }

            return normalizeToHundred(result);
        }

        // Bell Curve pattern
        function createBellPattern(count) {
            if (count === 1) return [100];
            if (count === 2) return [50, 50];
            if (count === 3) return [25, 50, 25];

            const result = [];
            const midpoint = (count - 1) / 2;
            const peakValue = 40;
            const edgeValue = 8;

            for (let i = 0; i < count; i++) {
                const distanceFromMid = Math.abs(i - midpoint);
                const maxDistance = midpoint;
                const ratio = 1 - (distanceFromMid / maxDistance);
                const value = edgeValue + (ratio * (peakValue - edgeValue));
                result.push(value);
            }

            return normalizeToHundred(result);
        }

        // Adjust scheme to package count
        function adjustSchemeToPackageCount(schemeKey, packageCount) {
            if (packageCount <= 0) return [];

            const scheme = claimingSchemes[schemeKey];
            if (!scheme) return [];

            switch (scheme.pattern) {
                case 'equal':
                    return distributeEvenly(packageCount);
                case 'descending':
                    return createDescendingPattern(packageCount);
                case 'ascending':
                    return createAscendingPattern(packageCount);
                case 'bell':
                    return createBellPattern(packageCount);
                default:
                    return distributeEvenly(packageCount);
            }
        }

        // Toggle claiming presets panel
        function toggleClaimingPresets() {
            const body = document.getElementById('preset-body');
            const header = document.querySelector('.preset-header span:first-child');

            if (body.classList.contains('hidden')) {
                body.classList.remove('hidden');
                header.textContent = '▼ SCHEME PRESETS';
            } else {
                body.classList.add('hidden');
                header.textContent = '▶ SCHEME PRESETS';
            }
        }

        // Get selected scheme from radio buttons
        function getSelectedScheme() {
            const selected = document.querySelector('input[name="claiming-scheme"]:checked');
            return selected ? selected.value : null;
        }

        // Preview scheme percentages
        function previewScheme() {
            const schemeKey = getSelectedScheme();
            if (!schemeKey) {
                alert('Please select a claiming scheme first.');
                return;
            }

            const packageCount = projectData.packages.length;
            if (packageCount === 0) {
                alert('Please add packages first (Step 3).');
                return;
            }

            const percentages = adjustSchemeToPackageCount(schemeKey, packageCount);
            const scheme = claimingSchemes[schemeKey];

            const previewDiv = document.getElementById('preview-display');
            let previewHTML = `<strong>Preview: ${scheme.name}</strong><br>`;

            projectData.packages.forEach((pkg, i) => {
                previewHTML += `${pkg}: <strong>${percentages[i]}%</strong>`;
                if (i < projectData.packages.length - 1) {
                    previewHTML += ' | ';
                }
            });

            const total = percentages.reduce((a, b) => a + b, 0);
            previewHTML += `<br>Total: <strong style="color: ${total === 100 ? '#00ff00' : '#ff4444'}">${total}%</strong>`;

            previewDiv.innerHTML = previewHTML;
            previewDiv.classList.remove('hidden');
        }

        // Apply claiming scheme to all disciplines
        function applyClaimingScheme() {
            const schemeKey = getSelectedScheme();
            if (!schemeKey) {
                alert('Please select a claiming scheme first.');
                return;
            }

            if (projectData.disciplines.length === 0) {
                alert('Please add disciplines first (Step 2).');
                return;
            }

            if (projectData.packages.length === 0) {
                alert('Please add packages first (Step 3).');
                return;
            }

            const packageCount = projectData.packages.length;
            const percentages = adjustSchemeToPackageCount(schemeKey, packageCount);
            const scheme = claimingSchemes[schemeKey];

            // Apply to all disciplines
            projectData.disciplines.forEach(disc => {
                percentages.forEach((pct, i) => {
                    const pkg = projectData.packages[i];
                    const key = `${disc}-${pkg}`;
                    projectData.claiming[key] = pct;
                });
            });

            // Update UI
            buildClaimingTable();

            // Update status
            const statusSpan = document.getElementById('preset-status');
            statusSpan.textContent = `Applied: ${scheme.name}`;
            statusSpan.style.color = '#00ff00';

            // Collapse panel
            const body = document.getElementById('preset-body');
            const header = document.querySelector('.preset-header span:first-child');
            body.classList.add('hidden');
            header.textContent = '▶ SCHEME PRESETS';

            // Clear preview
            document.getElementById('preview-display').classList.add('hidden');
        }

        /**
         * Builds the schedule dates table for Step 6
         * Generates date inputs for each discipline-package combination with duration calculation
         * Now includes Activity IDs and design review steps
         */
        function buildDatesTable() {
            const table = document.getElementById('dates-table');
            const today = new Date();
            const fmt = d => d.toISOString().split('T')[0];
            
            // Initialize unique IDs if not already done
            initializeUniqueIds();
            
            let html = `
                <thead>
                    <tr>
                        <th style="width: 120px;">ACTIVITY ID</th>
                        <th>ACTIVITY DESCRIPTION</th>
                        <th>REVIEW STEP</th>
                        <th>START</th>
                        <th>END</th>
                        <th style="text-align: center; width: 60px;">DAYS</th>
                    </tr>
                </thead>
                <tbody>
            `;
            
            projectData.disciplines.forEach((disc, discIndex) => {
                projectData.packages.forEach((pkg, pkgIndex) => {
                    const key = `${disc}-${pkg}`;
                    const activity = projectData.activities[key] || generateActivityInfo(disc, pkg);
                    
                    // Calculate default dates if not saved
                    const defaultStartDate = new Date(today);
                    defaultStartDate.setDate(defaultStartDate.getDate() + (discIndex * projectData.packages.length + pkgIndex) * 45);
                    const defaultEndDate = new Date(defaultStartDate);
                    defaultEndDate.setDate(defaultEndDate.getDate() + 42);
                    
                    const saved = projectData.dates[key] || {};
                    const activityStart = saved.start || fmt(defaultStartDate);
                    const activityEnd = saved.end || fmt(defaultEndDate);
                    
                    // Save dates if not already saved (for review step calculation)
                    if (!saved.start || !saved.end) {
                        projectData.dates[key] = { start: activityStart, end: activityEnd };
                    }
                    
                    // Initialize review steps for this activity
                    initializeReviewSteps(disc, pkg);
                    const reviewSteps = projectData.reviewSteps[key] || [];
                    
                    // First row: Activity header row (collapsible)
                    const isFirstPkg = pkgIndex === 0;
                    const discIdDisplay = isFirstPkg ? `<span style="color: #4da6ff; font-size: 10px;">${projectData.disciplineIds[disc] || ''}</span><br>` : '';
                    
                    html += `
                        <tr class="activity-header-row" data-key="${key}" onclick="toggleReviewSteps('${key}')">
                            <td style="cursor: pointer;">
                                ${discIdDisplay}
                                <span style="color: #ffd700; font-weight: 600;">${activity.id}</span>
                            </td>
                            <td style="cursor: pointer;">
                                ${isFirstPkg ? `<span style="color: #888; font-size: 11px;">${disc}</span><br>` : ''}
                                <span style="color: #fff;">${activity.description}</span>
                            </td>
                            <td style="color: #888; cursor: pointer;">
                                <span class="expand-icon" id="expand-${key}">▶</span> 
                                ${reviewSteps.length} review steps
                            </td>
                            <td><input type="date" class="table-input date-start" data-key="${key}" value="${activityStart}" onclick="event.stopPropagation()"></td>
                            <td><input type="date" class="table-input date-end" data-key="${key}" value="${activityEnd}" onclick="event.stopPropagation()"></td>
                            <td class="duration-cell" data-key="${key}" style="text-align: center;">--</td>
                        </tr>
                    `;
                    
                    // Review step rows (hidden by default) - using industry-standard generic steps
                    reviewSteps.forEach((step, stepIndex) => {
                        const stepKey = `${key}-step-${stepIndex}`;
                        const industryRef = step.industryDays ? `<span title="Industry standard: ${step.industryDays} days" style="color: #4da6ff; font-size: 9px; margin-left: 4px;">(${step.industryDays}d)</span>` : '';
                        html += `
                            <tr class="review-step-row hidden" data-parent="${key}">
                                <td style="padding-left: 20px; color: #666; font-size: 11px;">${stepIndex + 1}</td>
                                <td style="padding-left: 20px; color: #aaa; font-size: 12px;">${step.step}${industryRef}</td>
                                <td></td>
                                <td><input type="date" class="table-input review-step-start" data-step-key="${stepKey}" value="${step.start}" onchange="updateReviewStepDates('${key}', ${stepIndex}, 'start', this.value)"></td>
                                <td><input type="date" class="table-input review-step-end" data-step-key="${stepKey}" value="${step.end}" onchange="updateReviewStepDates('${key}', ${stepIndex}, 'end', this.value)"></td>
                                <td class="review-step-duration" data-step-key="${stepKey}" style="text-align: center; color: #888; font-size: 11px;">${step.days || '--'}</td>
                            </tr>
                        `;
                    });
                });
            });
            
            html += '</tbody>';
            table.innerHTML = html;
            
            document.querySelectorAll('.date-start, .date-end').forEach(input => {
                input.addEventListener('change', function() {
                    updateDurations();
                    recalculateReviewSteps(this.dataset.key);
                });
            });
            updateDurations();
        }
        
        /**
         * Toggles visibility of review steps for an activity
         */
        function toggleReviewSteps(key) {
            const rows = document.querySelectorAll(`.review-step-row[data-parent="${key}"]`);
            const expandIcon = document.getElementById(`expand-${key}`);
            
            rows.forEach(row => {
                row.classList.toggle('hidden');
            });
            
            if (expandIcon) {
                expandIcon.textContent = expandIcon.textContent === '▶' ? '▼' : '▶';
            }
        }
        
        /**
         * Updates review step dates when manually edited
         */
        function updateReviewStepDates(activityKey, stepIndex, field, value) {
            if (!projectData.reviewSteps[activityKey]) return;
            
            const step = projectData.reviewSteps[activityKey][stepIndex];
            if (step) {
                step[field] = value;
                
                // Recalculate days
                if (step.start && step.end) {
                    step.days = Math.ceil((new Date(step.end) - new Date(step.start)) / (1000 * 60 * 60 * 24));
                }
                
                // Update the duration display
                const stepKey = `${activityKey}-step-${stepIndex}`;
                const durationCell = document.querySelector(`.review-step-duration[data-step-key="${stepKey}"]`);
                if (durationCell) {
                    durationCell.textContent = step.days || '--';
                }
                
                triggerAutosave();
            }
        }
        
        /**
         * Recalculates review steps when activity dates change
         * Uses industry-standard durations based on project type, discipline, and package
         */
        function recalculateReviewSteps(activityKey) {
            if (!activityKey) return;
            
            const startInput = document.querySelector(`.date-start[data-key="${activityKey}"]`);
            const endInput = document.querySelector(`.date-end[data-key="${activityKey}"]`);
            
            if (!startInput || !endInput) return;
            
            const startDate = new Date(startInput.value);
            const endDate = new Date(endInput.value);
            
            if (isNaN(startDate) || isNaN(endDate)) return;
            
            const totalDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
            if (totalDays <= 0) return;
            
            // Parse discipline and package from activity key
            const [discipline, packageName] = activityKey.split('-');
            
            // Get industry-standard review steps for this discipline/package
            const industrySteps = getIndustryReviewSteps(discipline, packageName);
            
            // Recalculate review steps using industry percentages
            let currentStart = new Date(startDate);
            projectData.reviewSteps[activityKey] = industrySteps.map((step) => {
                const stepDays = Math.max(1, Math.ceil(totalDays * (step.durationPercent / 100)));
                const stepEnd = new Date(currentStart);
                stepEnd.setDate(stepEnd.getDate() + stepDays);
                
                const result = {
                    step: step.name,
                    start: currentStart.toISOString().split('T')[0],
                    end: stepEnd.toISOString().split('T')[0],
                    days: stepDays,
                    industryDays: step.industryDays
                };
                
                currentStart = new Date(stepEnd);
                return result;
            });
            
            // Refresh the table to show updated values
            buildDatesTable();
            triggerAutosave();
        }

        /**
         * Calculates and displays duration in days for each date range in the schedule table
         */
        function updateDurations() {
            document.querySelectorAll('.duration-cell').forEach(cell => {
                const key = cell.dataset.key;
                const start = document.querySelector(`.date-start[data-key="${key}"]`).value;
                const end = document.querySelector(`.date-end[data-key="${key}"]`).value;
                
                if (start && end) {
                    const days = Math.ceil((new Date(end) - new Date(start)) / (1000 * 60 * 60 * 24));
                    cell.textContent = days > 0 ? days : 'ERR';
                    cell.className = `duration-cell ${days > 0 ? 'status-ok' : 'status-err'}`;
                }
            });
        }

        function generateWBS() {
            saveCurrentStep();
            
            // Hide the wizard terminal (keeps header visible)
            document.getElementById('wizard-terminal').style.display = 'none';
            document.getElementById('results-section').classList.remove('hidden');
            
            buildWBSTable();
            populateFilters();
            createChart();
            buildGanttChart();
            updateKPIs();
            updateStatus('WBS GENERATED');
            
            // Show the reports button and update back button for results page
            updateReportsButtonVisibility();
            
            // Show back button and hide next/generate buttons on results page
            document.getElementById('prev-btn').classList.remove('hidden');
            document.getElementById('next-btn').classList.add('hidden');
            document.getElementById('generate-btn').classList.add('hidden');
        }

        function updateKPIs() {
            let total = 0;
            let wbsCount = 0;
            let minDate = null, maxDate = null;
            
            projectData.disciplines.forEach(disc => {
                total += projectData.budgets[disc] || 0;
                wbsCount += projectData.packages.length * projectData.phases.length;
                
                projectData.packages.forEach(pkg => {
                    const d = projectData.dates[`${disc}-${pkg}`];
                    if (d) {
                        const s = new Date(d.start), e = new Date(d.end);
                        if (!minDate || s < minDate) minDate = s;
                        if (!maxDate || e > maxDate) maxDate = e;
                    }
                });
            });
            
            const months = minDate && maxDate ? Math.ceil((maxDate - minDate) / (1000 * 60 * 60 * 24 * 30)) : 0;
            
            document.getElementById('kpi-budget').textContent = '$' + total.toLocaleString();
            document.getElementById('kpi-wbs').textContent = wbsCount;
            document.getElementById('kpi-disc').textContent = projectData.disciplines.length;
            document.getElementById('kpi-months').textContent = months;
        }

        // Track expanded disciplines in WBS table
        const wbsTableState = {
            expandedDisciplines: new Set()
        };

        /**
         * Generates WBS table header HTML
         * @returns {string} HTML string for table header
         */
        function generateWBSTableHeader() {
            return `
                <thead>
                    <tr>
                        <th>WBS#</th>
                        <th>ACTIVITY ID</th>
                        <th>PHASE</th>
                        <th>DISCIPLINE</th>
                        <th>PACKAGE</th>
                        <th style="text-align: right;">BUDGET</th>
                        <th style="text-align: center;">%</th>
                        <th>START</th>
                        <th>END</th>
                        <th style="text-align: right;">ACTUAL</th>
                        <th style="text-align: right;">VAR</th>
                    </tr>
                </thead>
            `;
        }

        /**
         * Generates a discipline summary row (parent row)
         */
        function generateWBSDisciplineRow(wbsPrefix, phase, discipline, totalBudget, startDate, endDate, phaseIndex, disciplineIndex) {
            const rowId = `wbs-disc-${phaseIndex}-${disciplineIndex}`;
            const isExpanded = wbsTableState.expandedDisciplines.has(rowId);
            const discId = projectData.disciplineIds[discipline] || '';
            return `
                <tr class="wbs-discipline-row" data-row-id="${rowId}" onclick="toggleWBSDiscipline('${rowId}')">
                    <td><span class="wbs-expand-icon ${isExpanded ? 'expanded' : ''}">▶</span> ${wbsPrefix}</td>
                    <td style="color: #4da6ff;">${discId}</td>
                    <td>${phase}</td>
                    <td>${discipline}</td>
                    <td style="color: #888; font-weight: 400;">${projectData.packages.length} packages</td>
                    <td style="text-align: right;">$${Math.round(totalBudget).toLocaleString()}</td>
                    <td style="text-align: center;">100%</td>
                    <td>${startDate}</td>
                    <td>${endDate}</td>
                    <td style="text-align: right; color: #666;">$0</td>
                    <td style="text-align: right; color: #00ff00;">$${Math.round(totalBudget).toLocaleString()}</td>
                </tr>
            `;
        }

        /**
         * Generates a single WBS package row (child row)
         */
        function generateWBSPackageRow(wbsNumber, phase, discipline, packageName, packageBudget, claimPercent, dates, rowId) {
            const isExpanded = wbsTableState.expandedDisciplines.has(rowId);
            const key = `${discipline}-${packageName}`;
            const activity = projectData.activities[key] || { id: '', description: '' };
            return `
                <tr class="wbs-package-row ${isExpanded ? '' : 'hidden'}" data-parent="${rowId}">
                    <td style="color: #888;">${wbsNumber}</td>
                    <td style="color: #ffd700; font-size: 11px;">${activity.id}</td>
                    <td style="color: #666;">${phase}</td>
                    <td style="color: #666;">${discipline}</td>
                    <td style="color: #ffd700;">${packageName}</td>
                    <td style="text-align: right;">$${Math.round(packageBudget).toLocaleString()}</td>
                    <td style="text-align: center;">${claimPercent}%</td>
                    <td>${dates.start}</td>
                    <td>${dates.end}</td>
                    <td style="text-align: right; color: #666;">$0</td>
                    <td style="text-align: right; color: #00ff00;">$${Math.round(packageBudget).toLocaleString()}</td>
                </tr>
            `;
        }

        /**
         * Generates WBS table footer with grand total
         * @param {number} grandTotal - Total budget across all WBS elements
         * @returns {string} HTML string for table footer
         */
        function generateWBSTableFooter(grandTotal) {
            return `
                <tfoot>
                    <tr>
                        <td colspan="5">GRAND TOTAL</td>
                        <td style="text-align: right;">$${Math.round(grandTotal).toLocaleString()}</td>
                        <td></td>
                        <td colspan="2"></td>
                        <td style="text-align: right;">$0</td>
                        <td style="text-align: right;">$${Math.round(grandTotal).toLocaleString()}</td>
                    </tr>
                </tfoot>
            `;
        }

        /**
         * Toggles a discipline row's expanded state
         */
        function toggleWBSDiscipline(rowId) {
            if (wbsTableState.expandedDisciplines.has(rowId)) {
                wbsTableState.expandedDisciplines.delete(rowId);
            } else {
                wbsTableState.expandedDisciplines.add(rowId);
            }
            
            // Toggle visibility of child rows
            document.querySelectorAll(`.wbs-package-row[data-parent="${rowId}"]`).forEach(row => {
                row.classList.toggle('hidden');
            });
            
            // Toggle expand icon
            const discRow = document.querySelector(`.wbs-discipline-row[data-row-id="${rowId}"]`);
            if (discRow) {
                const icon = discRow.querySelector('.wbs-expand-icon');
                icon.classList.toggle('expanded');
            }
        }

        /**
         * Expands all discipline rows in WBS table
         */
        function expandAllWBS() {
            document.querySelectorAll('.wbs-discipline-row').forEach(row => {
                const rowId = row.dataset.rowId;
                wbsTableState.expandedDisciplines.add(rowId);
            });
            document.querySelectorAll('.wbs-package-row').forEach(row => row.classList.remove('hidden'));
            document.querySelectorAll('.wbs-expand-icon').forEach(icon => icon.classList.add('expanded'));
        }

        /**
         * Collapses all discipline rows in WBS table
         */
        function collapseAllWBS() {
            wbsTableState.expandedDisciplines.clear();
            document.querySelectorAll('.wbs-package-row').forEach(row => row.classList.add('hidden'));
            document.querySelectorAll('.wbs-expand-icon').forEach(icon => icon.classList.remove('expanded'));
        }

        /**
         * Builds the complete WBS table with collapsible discipline groups
         * Generates hierarchical WBS numbering and calculates budget distribution
         */
        function buildWBSTable() {
            const table = document.getElementById('wbs-table');
            let grandTotal = 0;
            
            // Initialize unique IDs for disciplines and packages
            initializeUniqueIds();
            
            let html = generateWBSTableHeader() + '<tbody>';
            
            projectData.phases.forEach((phase, phaseIndex) => {
                projectData.disciplines.forEach((discipline, disciplineIndex) => {
                    const disciplineBudget = projectData.budgets[discipline] || 0;
                    const wbsPrefix = `${phaseIndex + 1}.${disciplineIndex + 1}`;
                    const rowId = `wbs-disc-${phaseIndex}-${disciplineIndex}`;
                    
                    // Calculate discipline date range
                    let minStart = null, maxEnd = null;
                    projectData.packages.forEach(pkg => {
                        const key = `${discipline}-${pkg}`;
                        const dates = projectData.dates[key];
                        if (dates) {
                            if (dates.start && (!minStart || dates.start < minStart)) minStart = dates.start;
                            if (dates.end && (!maxEnd || dates.end > maxEnd)) maxEnd = dates.end;
                        }
                    });
                    
                    // Add discipline summary row
                    html += generateWBSDisciplineRow(
                        wbsPrefix,
                        phase,
                        discipline,
                        disciplineBudget,
                        minStart || '-',
                        maxEnd || '-',
                        phaseIndex,
                        disciplineIndex
                    );
                    
                    // Add package rows (children)
                    projectData.packages.forEach((packageName, packageIndex) => {
                        const key = `${discipline}-${packageName}`;
                        const claimPercent = projectData.claiming[key] || 0;
                        const packageBudget = disciplineBudget * (claimPercent / 100);
                        const dates = projectData.dates[key] || { start: '-', end: '-' };
                        const wbsNumber = `${phaseIndex + 1}.${disciplineIndex + 1}.${packageIndex + 1}`;
                        
                        grandTotal += packageBudget;
                        
                        html += generateWBSPackageRow(
                            wbsNumber, 
                            phase, 
                            discipline, 
                            packageName, 
                            packageBudget, 
                            claimPercent, 
                            dates,
                            rowId
                        );
                    });
                });
            });
            
            html += '</tbody>' + generateWBSTableFooter(grandTotal);
            table.innerHTML = html;
        }

        function populateFilters() {
            document.getElementById('filter-phase').innerHTML = '<option value="all">All Phases</option>' +
                projectData.phases.map(p => `<option value="${p}">${p}</option>`).join('');
            
            document.getElementById('filter-discipline').innerHTML = '<option value="all">All Disciplines</option>' +
                projectData.disciplines.map(d => `<option value="${d}">${d}</option>`).join('');
        }

        /**
         * Creates and configures the Chart.js chart
         * Handles both line charts and stacked bar charts with percentage labels
         */
        function createChart() {
            const ctx = document.getElementById('performance-chart').getContext('2d', { willReadFrequently: true });
            if (chart) chart.destroy();
            
            const data = getChartData();
            const type = document.getElementById('chart-type').value;
            const isStackedBar = type === 'bar' && data.datasets;
            
            // Configure chart options based on chart type
            const chartOptions = {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { 
                        display: isStackedBar,
                        position: 'bottom',
                        labels: {
                            color: '#ffd700',
                            font: { size: 11 },
                            padding: 10,
                            usePointStyle: true
                        }
                    },
                    tooltip: {
                        backgroundColor: '#1a1a1a',
                        titleColor: '#ffd700',
                        bodyColor: '#fff',
                        borderColor: '#ffd700',
                        borderWidth: 1,
                        callbacks: {
                            label: (context) => {
                                const label = context.dataset.label || '';
                                const value = '$' + context.raw.toLocaleString();
                                
                                if (isStackedBar && data.totals) {
                                    const total = data.totals[context.dataIndex];
                                    const percentage = total > 0 
                                        ? ((context.raw / total) * 100).toFixed(1) 
                                        : '0.0';
                                    return `${label}: ${value} (${percentage}%)`;
                                }
                                
                                return label + ': ' + value;
                            },
                            footer: (tooltipItems) => {
                                if (isStackedBar && data.totals) {
                                    const index = tooltipItems[0].dataIndex;
                                    return 'Total: $' + data.totals[index].toLocaleString();
                                }
                                return '';
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        stacked: isStackedBar,
                        grid: { color: '#333' },
                        ticks: {
                            color: '#888',
                            callback: v => '$' + (v/1000).toFixed(0) + 'K'
                        }
                    },
                    x: {
                        stacked: isStackedBar,
                        grid: { color: '#222' },
                        ticks: { color: '#888' }
                    }
                }
            };
            
            // Store totals for percentage calculation in plugin
            let chartTotals = null;
            if (isStackedBar && data.totals) {
                chartTotals = data.totals;
            }
            
            // Configure datasets based on chart type
            let datasets;
            if (isStackedBar) {
                datasets = data.datasets;
            } else {
                datasets = [
                    {
                        label: 'PLANNED',
                        data: data.planned,
                        borderColor: '#ffd700',
                        backgroundColor: 'rgba(255, 215, 0, 0.1)',
                        borderWidth: 2,
                        fill: true,
                        tension: 0.3
                    },
                    {
                        label: 'ACTUAL',
                        data: data.actual,
                        borderColor: '#00ff00',
                        backgroundColor: 'rgba(0, 255, 0, 0.1)',
                        borderWidth: 2,
                        borderDash: [5, 5],
                        fill: false,
                        tension: 0.3
                    }
                ];
            }
            
            chart = new Chart(ctx, {
                type: type,
                data: {
                    labels: data.labels,
                    datasets: datasets
                },
                options: chartOptions,
                plugins: isStackedBar ? [{
                    id: 'percentageLabels',
                    afterDatasetsDraw: (chart) => {
                        if (!chartTotals) return;
                        
                        const ctx = chart.ctx;
                        
                        chart.data.datasets.forEach((dataset, datasetIndex) => {
                            const meta = chart.getDatasetMeta(datasetIndex);
                            meta.data.forEach((bar, index) => {
                                const value = dataset.data[index];
                                const total = chartTotals[index];
                                
                                if (total > 0 && value > 0) {
                                    const percentage = ((value / total) * 100).toFixed(1);
                                    
                                    // Only show label if segment is large enough (>= 5%)
                                    if (percentage >= 5) {
                                        const x = bar.x;
                                        // For stacked bars, bar.y is the top and bar.base is the bottom
                                        const segmentHeight = Math.abs(bar.base - bar.y);
                                        
                                        // Only show if segment is tall enough to be readable
                                        if (segmentHeight > 15) {
                                            const y = bar.y + (segmentHeight / 2);
                                            
                                            ctx.save();
                                            ctx.fillStyle = '#fff';
                                            ctx.strokeStyle = '#000';
                                            ctx.lineWidth = 2;
                                            ctx.font = 'bold 10px JetBrains Mono';
                                            ctx.textAlign = 'center';
                                            ctx.textBaseline = 'middle';
                                            
                                            // Add text stroke for better visibility
                                            ctx.strokeText(percentage + '%', x, y);
                                            ctx.fillText(percentage + '%', x, y);
                                            ctx.restore();
                                        }
                                    }
                                }
                            });
                        });
                    }
                }] : []
            });
        }

        /**
         * Generates a color palette for disciplines with distinct, visible colors
         * @param {number} count - Number of colors needed
         * @returns {Array<string>} Array of color hex codes
         */
        function generateDisciplineColors(count) {
            // Distinct color palette optimized for visibility and contrast
            const colors = [
                '#ffd700', // Gold (primary)
                '#00ff88', // Green
                '#00aaff', // Blue
                '#ff6b6b', // Red
                '#9b59b6', // Purple
                '#f39c12', // Orange
                '#1abc9c', // Turquoise
                '#e74c3c', // Dark Red
                '#3498db', // Light Blue
                '#2ecc71', // Dark Green
                '#e67e22', // Dark Orange
                '#16a085', // Dark Turquoise
                '#c0392b', // Darker Red
                '#8e44ad', // Dark Purple
                '#2980b9', // Dark Blue
                '#27ae60', // Darker Green
                '#d35400', // Very Dark Orange
                '#7f8c8d'  // Gray
            ];
            return colors.slice(0, count);
        }

        /**
         * Collects chart items grouped by discipline
         * @param {string} disciplineFilter - Selected discipline filter ('all' or discipline name)
         * @returns {Object} Object with items per discipline and all dates
         */
        function collectChartItemsByDiscipline(disciplineFilter) {
            const itemsByDiscipline = {};
            const allDates = [];
            const disciplinesToShow = disciplineFilter === 'all' 
                ? projectData.disciplines 
                : [disciplineFilter];

            disciplinesToShow.forEach(discipline => {
                itemsByDiscipline[discipline] = [];
                const disciplineBudget = projectData.budgets[discipline] || 0;
                
                projectData.packages.forEach(packageName => {
                    const key = `${discipline}-${packageName}`;
                    const dates = projectData.dates[key];
                    const claimPct = projectData.claiming[key] || 0;
                    const packageBudget = disciplineBudget * (claimPct / 100);
                    
                    if (dates && dates.start && dates.end) {
                        const startDate = new Date(dates.start);
                        const endDate = new Date(dates.end);
                        itemsByDiscipline[discipline].push({
                            start: startDate,
                            end: endDate,
                            budget: packageBudget
                        });
                        allDates.push(startDate, endDate);
                    }
                });
            });

            return { itemsByDiscipline, allDates };
        }

        /**
         * Collects chart items from project data based on discipline filter
         * @param {string} disciplineFilter - Selected discipline filter ('all' or discipline name)
         * @returns {Array<Object>} Array of items with start, end dates and budget
         */
        function collectChartItems(disciplineFilter) {
            const items = [];
            const allDates = [];

            projectData.disciplines.forEach(discipline => {
                if (disciplineFilter !== 'all' && discipline !== disciplineFilter) return;
                const disciplineBudget = projectData.budgets[discipline] || 0;
                
                projectData.packages.forEach(packageName => {
                    const key = `${discipline}-${packageName}`;
                    const dates = projectData.dates[key];
                    const claimPct = projectData.claiming[key] || 0;
                    const packageBudget = disciplineBudget * (claimPct / 100);
                    
                    if (dates && dates.start && dates.end) {
                        const startDate = new Date(dates.start);
                        const endDate = new Date(dates.end);
                        items.push({
                            start: startDate,
                            end: endDate,
                            budget: packageBudget
                        });
                        allDates.push(startDate, endDate);
                    }
                });
            });

            return { items, allDates };
        }

        /**
         * Calculates the date range for chart display
         * @param {Array<Date>} allDates - Array of all start and end dates
         * @returns {{start: Date, end: Date}} Start and end dates for chart
         */
        function calculateChartDateRange(allDates) {
            if (!allDates.length) return null;

            allDates.sort((a, b) => a - b);
            const startDate = new Date(allDates[0].getFullYear(), allDates[0].getMonth(), 1);
            const endDate = new Date(
                allDates[allDates.length - 1].getFullYear(), 
                allDates[allDates.length - 1].getMonth() + 1, 
                1
            );
            return { start: startDate, end: endDate };
        }

        /**
         * Calculates monthly budget for a given month
         * @param {Date} currentMonth - Current month being calculated
         * @param {Array<Object>} items - Chart items with dates and budgets
         * @returns {number} Monthly budget amount
         */
        function calculateMonthlyBudget(currentMonth, items) {
            let monthly = 0;
            items.forEach(item => {
                const months = Math.max(1, Math.ceil((item.end - item.start) / (1000 * 60 * 60 * 24 * 30)));
                if (currentMonth >= item.start && currentMonth <= item.end) {
                    monthly += item.budget / months;
                }
            });
            return monthly;
        }

        /**
         * Generates chart data points (labels, planned, actual) for the date range
         * @param {Date} startDate - Chart start date
         * @param {Date} endDate - Chart end date
         * @param {Array<Object>} items - Chart items with dates and budgets
         * @param {string} viewType - 'cumulative' or 'monthly'
         * @returns {{labels: Array<string>, planned: Array<number>, actual: Array<number>}}
         */
        function generateChartDataPoints(startDate, endDate, items, viewType) {
            const labels = [];
            const planned = [];
            const actual = [];
            let cumulative = 0;
            const current = new Date(startDate);

            while (current <= endDate) {
                labels.push(current.toLocaleDateString('en-US', { year: '2-digit', month: 'short' }));
                
                const monthly = calculateMonthlyBudget(current, items);
                
                if (viewType === 'cumulative') {
                    cumulative += monthly;
                    planned.push(Math.round(cumulative));
                } else {
                    planned.push(Math.round(monthly));
                }
                actual.push(0);
                
                current.setMonth(current.getMonth() + 1);
            }

            return { labels, planned, actual };
        }

        /**
         * Generates stacked chart data points per discipline
         * @param {Date} startDate - Chart start date
         * @param {Date} endDate - Chart end date
         * @param {Object} itemsByDiscipline - Items grouped by discipline
         * @param {string} viewType - 'cumulative' or 'monthly'
         * @returns {{labels: Array<string>, datasets: Array<Object>}}
         */
        /**
         * Generates stacked chart data with discipline colors
         * @param {Date} startDate - Chart start date
         * @param {Date} endDate - Chart end date
         * @param {Object} itemsByDiscipline - Items grouped by discipline
         * @param {string} viewType - 'cumulative' or 'monthly'
         * @returns {{labels: Array<string>, datasets: Array<Object>, totals: Array<number>}}
         */
        function generateStackedChartData(startDate, endDate, itemsByDiscipline, viewType) {
            const labels = [];
            const disciplines = Object.keys(itemsByDiscipline);
            const colors = generateDisciplineColors(disciplines.length);
            const datasets = disciplines.map((discipline, index) => ({
                label: discipline,
                data: [],
                backgroundColor: colors[index],
                borderColor: colors[index],
                borderWidth: 1
            }));
            
            const totals = []; // Store total for each month to calculate percentages
            let cumulativeByDiscipline = {};
            disciplines.forEach(disc => cumulativeByDiscipline[disc] = 0);
            
            const current = new Date(startDate);
            while (current <= endDate) {
                labels.push(current.toLocaleDateString('en-US', { year: '2-digit', month: 'short' }));
                
                let monthTotal = 0;
                disciplines.forEach((discipline, index) => {
                    const monthly = calculateMonthlyBudget(current, itemsByDiscipline[discipline]);
                    let value = monthly;
                    
                    if (viewType === 'cumulative') {
                        cumulativeByDiscipline[discipline] += monthly;
                        value = cumulativeByDiscipline[discipline];
                    }
                    
                    const rounded = Math.round(value);
                    datasets[index].data.push(rounded);
                    monthTotal += rounded;
                });
                
                totals.push(monthTotal);
                current.setMonth(current.getMonth() + 1);
            }
            
            return { labels, datasets, totals };
        }

        /**
         * Gets chart data based on current filters and view type
         * @returns {{labels: Array<string>, planned: Array<number>, actual: Array<number>} | {labels: Array<string>, datasets: Array<Object>}}
         */
        function getChartData() {
            const disciplineFilter = document.getElementById('filter-discipline').value;
            const viewType = document.getElementById('view-type').value;
            const chartType = document.getElementById('chart-type').value;
            
            // For stacked bar charts, use discipline-grouped data
            if (chartType === 'bar') {
                const { itemsByDiscipline, allDates } = collectChartItemsByDiscipline(disciplineFilter);
                
                if (!allDates.length) {
                    return { labels: ['N/A'], datasets: [] };
                }
                
                const dateRange = calculateChartDateRange(allDates);
                if (!dateRange) {
                    return { labels: ['N/A'], datasets: [] };
                }
                
                return generateStackedChartData(dateRange.start, dateRange.end, itemsByDiscipline, viewType);
            } else {
                // For line charts, use original format
                const { items, allDates } = collectChartItems(disciplineFilter);
                
                if (!allDates.length) {
                    return { labels: ['N/A'], planned: [0], actual: [0] };
                }
                
                const dateRange = calculateChartDateRange(allDates);
                if (!dateRange) {
                    return { labels: ['N/A'], planned: [0], actual: [0] };
                }
                
                return generateChartDataPoints(dateRange.start, dateRange.end, items, viewType);
            }
        }

        function updateChart() {
            createChart();
        }

        function editWBS() {
            document.getElementById('wizard-terminal').style.display = 'block';
            document.getElementById('results-section').classList.add('hidden');
            currentStep = 4; // Start at Benchmarking
            showStep(4);
            
            // Hide the reports button and exit edit mode
            updateReportsButtonVisibility();
            if (wbsEditMode) toggleWBSEditMode();
        }

        // ============================================
        // WBS INLINE EDITING SYSTEM
        // ============================================
        
        let wbsEditMode = false;

        /**
         * Toggles WBS edit mode
         */
        function toggleWBSEditMode() {
            wbsEditMode = !wbsEditMode;
            const toolbar = document.getElementById('wbs-edit-toolbar');
            const toggleBtn = document.getElementById('wbs-edit-toggle');
            
            if (wbsEditMode) {
                toolbar.classList.remove('hidden');
                toggleBtn.classList.add('btn-primary');
                toggleBtn.innerHTML = '✓ EDITING';
                // Rebuild table with editable cells
                buildWBSTableEditable();
            } else {
                toolbar.classList.add('hidden');
                toggleBtn.classList.remove('btn-primary');
                toggleBtn.innerHTML = '✏️ EDIT MODE';
                // Rebuild regular table
                buildWBSTable();
            }
        }

        /**
         * Builds WBS table with inline editable fields
         */
        function buildWBSTableEditable() {
            const table = document.getElementById('wbs-table');
            let grandTotal = 0;
            
            // Initialize unique IDs for disciplines and packages
            initializeUniqueIds();
            
            let html = `
                <thead>
                    <tr>
                        <th style="width: 30px;"></th>
                        <th>WBS#</th>
                        <th>ACTIVITY ID</th>
                        <th>PHASE</th>
                        <th>DISCIPLINE</th>
                        <th>PACKAGE</th>
                        <th style="text-align: right;">BUDGET</th>
                        <th style="text-align: center;">CLAIM %</th>
                        <th>START</th>
                        <th>END</th>
                    </tr>
                </thead>
                <tbody>
            `;
            
            projectData.phases.forEach((phase, phaseIndex) => {
                projectData.disciplines.forEach((discipline, disciplineIndex) => {
                    const disciplineBudget = projectData.budgets[discipline] || 0;
                    const wbsPrefix = `${phaseIndex + 1}.${disciplineIndex + 1}`;
                    const rowId = `wbs-disc-${phaseIndex}-${disciplineIndex}`;
                    const discId = projectData.disciplineIds[discipline] || '';
                    
                    // Calculate discipline date range
                    let minStart = null, maxEnd = null;
                    projectData.packages.forEach(pkg => {
                        const key = `${discipline}-${pkg}`;
                        const dates = projectData.dates[key];
                        if (dates) {
                            if (dates.start && (!minStart || dates.start < minStart)) minStart = dates.start;
                            if (dates.end && (!maxEnd || dates.end > maxEnd)) maxEnd = dates.end;
                        }
                    });
                    
                    // Discipline summary row with edit controls
                    html += `
                        <tr class="wbs-discipline-row" data-row-id="${rowId}">
                            <td>
                                <button class="wbs-delete-btn" onclick="event.stopPropagation(); confirmDeleteDiscipline('${discipline}')" title="Delete discipline">✕</button>
                            </td>
                            <td onclick="toggleWBSDiscipline('${rowId}')">
                                <span class="wbs-expand-icon ${wbsTableState.expandedDisciplines.has(rowId) ? 'expanded' : ''}">▶</span> ${wbsPrefix}
                            </td>
                            <td style="color: #4da6ff;">${discId}</td>
                            <td>${phase}</td>
                            <td style="font-weight: 600; color: #ffd700;">${discipline}</td>
                            <td style="color: #888;">${projectData.packages.length} packages</td>
                            <td style="text-align: right;">
                                <span class="wbs-editable" onclick="event.stopPropagation(); editDisciplineBudget('${discipline}', this)">
                                    $${Math.round(disciplineBudget).toLocaleString()}
                                </span>
                            </td>
                            <td style="text-align: center;">100%</td>
                            <td>${minStart || '-'}</td>
                            <td>${maxEnd || '-'}</td>
                        </tr>
                    `;
                    
                    grandTotal += disciplineBudget;
                    
                    // Package rows
                    projectData.packages.forEach((packageName, packageIndex) => {
                        const key = `${discipline}-${packageName}`;
                        const claimPct = projectData.claiming[key] || 0;
                        const packageBudget = disciplineBudget * (claimPct / 100);
                        const dates = projectData.dates[key] || { start: '', end: '' };
                        const wbsNumber = `${wbsPrefix}.${packageIndex + 1}`;
                        const isExpanded = wbsTableState.expandedDisciplines.has(rowId);
                        const activity = projectData.activities[key] || { id: '', description: '' };
                        
                        html += `
                            <tr class="wbs-package-row ${isExpanded ? '' : 'hidden'}" data-parent="${rowId}">
                                <td>
                                    <button class="wbs-delete-btn" onclick="confirmDeletePackage('${packageName}')" title="Delete package">✕</button>
                                </td>
                                <td style="color: #888;">${wbsNumber}</td>
                                <td style="color: #ffd700; font-size: 11px;">${activity.id}</td>
                                <td style="color: #666;">${phase}</td>
                                <td style="color: #666;">${discipline}</td>
                                <td style="color: #ffd700;">${packageName}</td>
                                <td style="text-align: right;">$${Math.round(packageBudget).toLocaleString()}</td>
                                <td style="text-align: center;">
                                    <span class="wbs-editable" onclick="editClaimPercent('${key}', this)">${claimPct}%</span>
                                </td>
                                <td>
                                    <input type="date" class="wbs-inline-input" value="${dates.start || ''}" 
                                           onchange="updateWBSDate('${key}', 'start', this.value)" style="width: 110px;">
                                </td>
                                <td>
                                    <input type="date" class="wbs-inline-input" value="${dates.end || ''}" 
                                           onchange="updateWBSDate('${key}', 'end', this.value)" style="width: 110px;">
                                </td>
                            </tr>
                        `;
                    });
                });
            });
            
            html += `
                </tbody>
                <tfoot>
                    <tr>
                        <td></td>
                        <td colspan="5">GRAND TOTAL</td>
                        <td style="text-align: right;">$${Math.round(grandTotal).toLocaleString()}</td>
                        <td colspan="3"></td>
                    </tr>
                </tfoot>
            `;
            
            table.innerHTML = html;
        }

        /**
         * Inline edit discipline budget
         */
        function editDisciplineBudget(discipline, element) {
            const currentValue = projectData.budgets[discipline] || 0;
            element.classList.add('editing');
            
            const input = document.createElement('input');
            input.type = 'number';
            input.className = 'wbs-inline-input';
            input.value = Math.round(currentValue);
            input.style.width = '100px';
            input.min = '0';
            
            element.innerHTML = '';
            element.appendChild(input);
            input.focus();
            input.select();
            
            const save = () => {
                const newValue = parseFloat(input.value) || 0;
                if (!validateBudget(newValue, 'Discipline budget')) {
                    input.focus();
                    return;
                }
                projectData.budgets[discipline] = newValue;
                projectData.calculator.manualEdits[discipline] = true;
                triggerAutosave();
                buildWBSTableEditable();
                updateKPIs();
                createChart();
            };
            
            input.addEventListener('blur', save);
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') { e.preventDefault(); save(); }
                if (e.key === 'Escape') buildWBSTableEditable();
            });
        }

        /**
         * Inline edit claim percentage
         */
        function editClaimPercent(key, element) {
            const currentValue = projectData.claiming[key] || 0;
            element.classList.add('editing');
            
            const input = document.createElement('input');
            input.type = 'number';
            input.className = 'wbs-inline-input';
            input.value = currentValue;
            input.min = '0';
            input.max = '100';
            input.step = '1';
            input.style.width = '60px';
            
            element.innerHTML = '';
            element.appendChild(input);
            input.focus();
            input.select();
            
            const save = () => {
                let newValue = parseFloat(input.value) || 0;
                if (!validatePercentage(newValue, 'Claim percentage')) {
                    newValue = Math.max(0, Math.min(100, newValue));
                }
                projectData.claiming[key] = Math.round(newValue);
                triggerAutosave();
                buildWBSTableEditable();
            };
            
            input.addEventListener('blur', save);
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') { e.preventDefault(); save(); }
                if (e.key === 'Escape') buildWBSTableEditable();
            });
        }

        /**
         * Update WBS date with validation
         */
        function updateWBSDate(key, field, value) {
            if (!projectData.dates[key]) {
                projectData.dates[key] = { start: '', end: '' };
            }
            
            const otherField = field === 'start' ? 'end' : 'start';
            const otherValue = projectData.dates[key][otherField];
            
            // Validate date order
            if (value && otherValue) {
                const newDate = new Date(value);
                const otherDate = new Date(otherValue);
                
                if (field === 'start' && newDate > otherDate) {
                    alert('Start date cannot be after end date. Adjusting end date.');
                    projectData.dates[key].end = value;
                }
                if (field === 'end' && newDate < otherDate) {
                    alert('End date cannot be before start date. Adjusting start date.');
                    projectData.dates[key].start = value;
                }
            }
            
            projectData.dates[key][field] = value;
            triggerAutosave();
            buildGanttChart();
            updateKPIs();
        }

        /**
         * Validates budget input
         * @returns {boolean} True if valid
         */
        function validateBudget(value, fieldName = 'Budget') {
            if (isNaN(value)) {
                alert(`${fieldName} must be a number`);
                return false;
            }
            if (value < 0) {
                alert(`${fieldName} cannot be negative`);
                return false;
            }
            if (value > 999999999999) {
                alert(`${fieldName} exceeds maximum allowed value`);
                return false;
            }
            return true;
        }

        /**
         * Validates percentage input
         * @returns {boolean} True if valid
         */
        function validatePercentage(value, fieldName = 'Percentage') {
            if (isNaN(value)) {
                alert(`${fieldName} must be a number`);
                return false;
            }
            if (value < 0 || value > 100) {
                alert(`${fieldName} must be between 0 and 100`);
                return false;
            }
            return true;
        }

        /**
         * Modal functions for adding elements
         */
        function showAddDisciplineModal() {
            document.getElementById('add-discipline-name').value = '';
            document.getElementById('add-discipline-budget').value = '0';
            document.getElementById('wbs-add-discipline-modal').classList.add('open');
            document.getElementById('add-discipline-name').focus();
        }

        function showAddPackageModal() {
            document.getElementById('add-package-name').value = '';
            document.getElementById('add-package-claim').value = '0';
            document.getElementById('wbs-add-package-modal').classList.add('open');
            document.getElementById('add-package-name').focus();
        }

        function showAddPhaseModal() {
            document.getElementById('add-phase-name').value = '';
            document.getElementById('wbs-add-phase-modal').classList.add('open');
            document.getElementById('add-phase-name').focus();
        }

        function closeAddModal(type) {
            document.getElementById(`wbs-add-${type}-modal`).classList.remove('open');
        }

        function confirmAddDiscipline() {
            const name = document.getElementById('add-discipline-name').value.trim();
            const budget = parseFloat(document.getElementById('add-discipline-budget').value) || 0;
            
            if (!name) {
                alert('Please enter a discipline name');
                return;
            }
            
            if (projectData.disciplines.includes(name)) {
                alert('This discipline already exists');
                return;
            }
            
            // Add discipline
            projectData.disciplines.push(name);
            projectData.budgets[name] = budget;
            
            // Initialize claiming for new discipline
            projectData.packages.forEach(pkg => {
                const key = `${name}-${pkg}`;
                projectData.claiming[key] = Math.floor(100 / projectData.packages.length);
            });
            
            // Initialize dates
            const today = new Date();
            projectData.packages.forEach((pkg, i) => {
                const key = `${name}-${pkg}`;
                const startDate = new Date(today);
                startDate.setDate(startDate.getDate() + i * 30);
                const endDate = new Date(startDate);
                endDate.setDate(endDate.getDate() + 28);
                projectData.dates[key] = {
                    start: startDate.toISOString().split('T')[0],
                    end: endDate.toISOString().split('T')[0]
                };
            });
            
            closeAddModal('discipline');
            triggerAutosave();
            buildWBSTableEditable();
            updateKPIs();
            createChart();
            buildGanttChart();
        }

        function confirmAddPackage() {
            const name = document.getElementById('add-package-name').value.trim();
            const claim = parseFloat(document.getElementById('add-package-claim').value) || 0;
            
            if (!name) {
                alert('Please enter a package name');
                return;
            }
            
            if (projectData.packages.includes(name)) {
                alert('This package already exists');
                return;
            }
            
            // Add package
            projectData.packages.push(name);
            
            // Initialize claiming and dates for new package
            const today = new Date();
            projectData.disciplines.forEach(disc => {
                const key = `${disc}-${name}`;
                projectData.claiming[key] = claim;
                
                const startDate = new Date(today);
                startDate.setDate(startDate.getDate() + projectData.packages.length * 30);
                const endDate = new Date(startDate);
                endDate.setDate(endDate.getDate() + 28);
                projectData.dates[key] = {
                    start: startDate.toISOString().split('T')[0],
                    end: endDate.toISOString().split('T')[0]
                };
            });
            
            closeAddModal('package');
            triggerAutosave();
            buildWBSTableEditable();
            updateKPIs();
            createChart();
            buildGanttChart();
        }

        function confirmAddPhase() {
            const name = document.getElementById('add-phase-name').value.trim();
            
            if (!name) {
                alert('Please enter a phase name');
                return;
            }
            
            if (projectData.phases.includes(name)) {
                alert('This phase already exists');
                return;
            }
            
            projectData.phases.push(name);
            
            closeAddModal('phase');
            triggerAutosave();
            buildWBSTableEditable();
            updateKPIs();
        }

        /**
         * Delete functions with confirmation
         */
        function confirmDeleteDiscipline(discipline) {
            const budget = projectData.budgets[discipline] || 0;
            if (!confirm(`Delete discipline "${discipline}"?\n\nThis will remove $${budget.toLocaleString()} from the budget.\n\nThis action cannot be undone.`)) {
                return;
            }
            
            const idx = projectData.disciplines.indexOf(discipline);
            if (idx > -1) {
                projectData.disciplines.splice(idx, 1);
                delete projectData.budgets[discipline];
                
                // Remove claiming and dates entries
                Object.keys(projectData.claiming).forEach(key => {
                    if (key.startsWith(`${discipline}-`)) {
                        delete projectData.claiming[key];
                    }
                });
                Object.keys(projectData.dates).forEach(key => {
                    if (key.startsWith(`${discipline}-`)) {
                        delete projectData.dates[key];
                    }
                });
            }
            
            triggerAutosave();
            buildWBSTableEditable();
            updateKPIs();
            createChart();
            buildGanttChart();
        }

        function confirmDeletePackage(packageName) {
            if (!confirm(`Delete package "${packageName}"?\n\nThis will affect all disciplines.\n\nThis action cannot be undone.`)) {
                return;
            }
            
            const idx = projectData.packages.indexOf(packageName);
            if (idx > -1) {
                projectData.packages.splice(idx, 1);
                
                // Remove claiming and dates entries
                Object.keys(projectData.claiming).forEach(key => {
                    if (key.endsWith(`-${packageName}`)) {
                        delete projectData.claiming[key];
                    }
                });
                Object.keys(projectData.dates).forEach(key => {
                    if (key.endsWith(`-${packageName}`)) {
                        delete projectData.dates[key];
                    }
                });
            }
            
            triggerAutosave();
            buildWBSTableEditable();
            updateKPIs();
            createChart();
            buildGanttChart();
        }

        /**
         * Recalculate budgets from calculator settings
         */
        function recalculateBudgets() {
            if (!projectData.calculator.isCalculated) {
                alert('No calculator settings found. Use the Wizard to set up budget calculations.');
                return;
            }
            
            if (!confirm('Recalculate all budgets from calculator settings?\n\nThis will override any manual budget edits.')) {
                return;
            }
            
            // Clear manual edits flag
            projectData.calculator.manualEdits = {};
            
            // Recalculate (uses same logic as calculator)
            const totalFee = projectData.calculator.totalDesignFee;
            const projectType = projectData.calculator.projectType;
            
            projectData.disciplines.forEach(disc => {
                const basePct = getIndustryPercent(disc, projectType);
                const complexity = projectData.calculator.complexityOverrides[disc] || 'Medium';
                const multiplier = complexity === 'Low' ? 0.85 : complexity === 'High' ? 1.15 : 1;
                projectData.budgets[disc] = Math.round(totalFee * (basePct / 100) * multiplier);
            });
            
            triggerAutosave();
            buildWBSTableEditable();
            updateKPIs();
            createChart();
        }

        /**
         * Gets industry standard percentage for a discipline
         */
        function getIndustryPercent(discipline, projectType) {
            const distributions = {
                'Highway/Roadway': { 'Roadway': 25, 'Structures': 15, 'Drainage': 12, 'Traffic': 10, 'Environmental': 10, 'Geotechnical': 8, 'Survey': 8, 'ROW': 5, 'Utilities': 7 },
                'Bridge': { 'Structures': 35, 'Roadway': 15, 'Geotechnical': 12, 'Environmental': 10, 'Traffic': 8, 'Drainage': 8, 'Survey': 7, 'Utilities': 5 },
                'Transit': { 'Transit Planning': 25, 'Structures': 15, 'Civil': 15, 'Systems': 15, 'Environmental': 10, 'Traffic': 10, 'Survey': 5, 'Utilities': 5 },
                'Water/Wastewater': { 'Process': 30, 'Civil': 20, 'Structural': 15, 'Mechanical': 12, 'Electrical': 10, 'I&C': 8, 'Environmental': 5 }
            };
            
            const dist = distributions[projectType] || distributions['Highway/Roadway'];
            return dist[discipline] || 5;
        }

        /**
         * Clear entire WBS with confirmation
         */
        function confirmClearWBS() {
            if (!confirm('⚠️ DANGER: Clear entire WBS?\n\nThis will remove ALL phases, disciplines, packages, budgets, and schedule data.\n\nThis action cannot be undone!')) {
                return;
            }
            
            if (!confirm('Are you absolutely sure? Type OK in the next prompt to confirm.')) {
                return;
            }
            
            projectData.phases = [];
            projectData.disciplines = [];
            projectData.packages = [];
            projectData.budgets = {};
            projectData.claiming = {};
            projectData.dates = {};
            
            triggerAutosave();
            buildWBSTableEditable();
            updateKPIs();
            createChart();
            buildGanttChart();
        }

        /**
         * Imports project data from CSV file
         */
        function importData() {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.csv';
            input.onchange = (e) => {
                const file = e.target.files[0];
                if (!file) return;
                
                const reader = new FileReader();
                reader.onload = (event) => {
                    try {
                        const csv = event.target.result;
                        parseImportCSV(csv);
                        alert('Data imported successfully! Returning to wizard...');
                        editWBS();
                    } catch (error) {
                        alert('Error importing data: ' + error.message);
                    }
                };
                reader.readAsText(file);
            };
            input.click();
        }

        /**
         * Parses imported CSV and populates projectData
         * @param {string} csv - CSV file content
         */
        function parseImportCSV(csv) {
            const lines = csv.split('\n').map(line => line.trim()).filter(line => line && !line.startsWith('#'));
            
            let currentSection = '';
            const data = {
                phases: [],
                disciplines: [],
                packages: [],
                budgets: {},
                claiming: {},
                dates: {},
                calculator: {
                    totalConstructionCost: 0,
                    designFeePercent: 15,
                    projectType: 'Highway/Roadway',
                    totalDesignFee: 0,
                    complexityOverrides: {},
                    isCalculated: false,
                    manualEdits: {}
                }
            };
            
            lines.forEach(line => {
                // Check for section headers
                if (line.startsWith('[') && line.endsWith(']')) {
                    currentSection = line.slice(1, -1);
                    return;
                }
                
                const parts = line.split(',').map(p => p.trim());
                if (parts.length < 2) return;
                
                switch (currentSection) {
                    case 'PHASES':
                        if (parts[0] === 'Phase') {
                            data.phases.push(parts[1]);
                        }
                        break;
                    case 'DISCIPLINES':
                        if (parts[0] === 'Discipline') {
                            data.disciplines.push(parts[1]);
                        }
                        break;
                    case 'PACKAGES':
                        if (parts[0] === 'Package') {
                            data.packages.push(parts[1]);
                        }
                        break;
                    case 'BUDGETS':
                        if (parts[0] !== 'Discipline') {
                            data.budgets[parts[0]] = parseFloat(parts[1]) || 0;
                        }
                        break;
                    case 'CLAIMING':
                        if (parts[0] !== 'Discipline') {
                            const key = `${parts[0]}-${parts[1]}`;
                            data.claiming[key] = parseFloat(parts[2]) || 0;
                        }
                        break;
                    case 'DATES':
                        if (parts[0] !== 'Discipline') {
                            const key = `${parts[0]}-${parts[1]}`;
                            data.dates[key] = {
                                start: parts[2] || '',
                                end: parts[3] || ''
                            };
                        }
                        break;
                    case 'CALCULATOR':
                        if (parts[0] !== 'Setting') {
                            const setting = parts[0];
                            const value = parts[1];
                            if (setting === 'TotalConstructionCost') {
                                data.calculator.totalConstructionCost = parseFloat(value) || 0;
                            } else if (setting === 'DesignFeePercent') {
                                data.calculator.designFeePercent = parseFloat(value) || 15;
                            } else if (setting === 'ProjectType') {
                                data.calculator.projectType = value;
                            } else if (setting === 'TotalDesignFee') {
                                data.calculator.totalDesignFee = parseFloat(value) || 0;
                            } else if (setting === 'IsCalculated') {
                                data.calculator.isCalculated = value === 'true';
                            }
                        }
                        break;
                    case 'COMPLEXITY_OVERRIDES':
                        if (parts[0] !== 'Discipline') {
                            data.calculator.complexityOverrides[parts[0]] = parts[1];
                        }
                        break;
                }
            });
            
            // Apply imported data to projectData
            projectData = data;
            
            // Update UI if we're in the wizard
            if (currentStep >= 1 && currentStep <= 6) {
                loadImportedData();
            }
        }

        /**
         * Loads imported data into the wizard forms
         */
        function loadImportedData() {
            // Step 1: Phases
            if (projectData.phases.length > 0) {
                document.getElementById('phases-input').value = projectData.phases.join(', ');
            }
            
            // Step 2: Disciplines - restore selections
            if (projectData.disciplines.length > 0) {
                // Rebuild discipline grid with imported selections
                const grid = document.getElementById('disciplines-grid');
                let html = '';
                
                // First, mark all existing disciplines
                allDisciplines.forEach(d => {
                    const isSelected = projectData.disciplines.includes(d.name);
                    html += `<div class="disc-item ${isSelected ? 'selected' : ''}" onclick="toggleDisc(this)" data-name="${d.name}">${d.name}</div>`;
                });
                
                // Add any custom disciplines that aren't in allDisciplines
                projectData.disciplines.forEach(discipline => {
                    if (!allDisciplines.find(d => d.name === discipline)) {
                        html += `<div class="disc-item selected" onclick="toggleDisc(this)" data-name="${discipline}">${discipline}</div>`;
                    }
                });
                
                grid.innerHTML = html;
                updateSelectedCount();
            }
            
            // Step 3: Packages
            if (projectData.packages.length > 0) {
                document.getElementById('packages-input').value = projectData.packages.join(', ');
            }
            
            // Steps 4-6 will be populated when those steps are shown via buildBudgetTable, etc.
        }

        /**
         * Generates cost estimate assumptions data for reports
         */
        function getCostEstimateAssumptions() {
            const calc = projectData.calculator;
            const projectType = calc.projectType || 'Highway/Roadway';
            const totalBudget = calculateTotalBudget();
            
            const assumptions = {
                constructionCost: calc.totalConstructionCost || 0,
                designFeePercent: calc.designFeePercent || 15,
                totalDesignFee: calc.totalDesignFee || totalBudget,
                projectType: projectType,
                isCalculated: calc.isCalculated,
                disciplines: []
            };
            
            projectData.disciplines.forEach(discipline => {
                const budget = projectData.budgets[discipline] || 0;
                const pctOfTotal = totalBudget > 0 ? ((budget / totalBudget) * 100) : 0;
                
                // Get complexity (override or auto-assigned)
                const complexity = calc.complexityOverrides[discipline] ||
                    (projectComplexityMap[projectType] ? projectComplexityMap[projectType][discipline] : null) ||
                    'Medium';
                
                // Get industry base percentage
                const distribution = industryDistribution[projectType];
                const industryPct = distribution && distribution[discipline] ? 
                    distribution[discipline][complexity] : 5;
                
                // Check if manually edited
                const isManualEdit = calc.manualEdits && calc.manualEdits[discipline];
                const hasComplexityOverride = calc.complexityOverrides && calc.complexityOverrides[discipline];
                
                assumptions.disciplines.push({
                    name: discipline,
                    budget: budget,
                    percentOfTotal: pctOfTotal.toFixed(1),
                    complexity: complexity,
                    industryBasePct: industryPct,
                    isManualEdit: isManualEdit,
                    hasComplexityOverride: hasComplexityOverride
                });
            });
            
            return assumptions;
        }

        /**
         * Opens print-friendly report view with charts
         */
        function printReport() {
            const printWindow = window.open('', '_blank');
            const today = new Date().toLocaleDateString();
            const assumptions = getCostEstimateAssumptions();
            
            // Capture the Performance Chart as an image
            let performanceChartImg = '';
            const chartCanvas = document.getElementById('performance-chart');
            if (chartCanvas && chart) {
                try {
                    performanceChartImg = chartCanvas.toDataURL('image/png');
                } catch (e) {
                    console.error('Could not capture chart:', e);
                }
            }
            
            // Capture the Gantt chart HTML
            const ganttContainer = document.getElementById('gantt-container');
            let ganttHtml = '';
            if (ganttContainer) {
                ganttHtml = ganttContainer.innerHTML;
            }
            
            // Calculate date range
            let minDate = null, maxDate = null;
            Object.values(projectData.dates).forEach(d => {
                if (d.start && (!minDate || d.start < minDate)) minDate = d.start;
                if (d.end && (!maxDate || d.end > maxDate)) maxDate = d.end;
            });
            
            let html = `
<!DOCTYPE html>
<html>
<head>
    <title>Project Cost Estimate Report</title>
    <style>
        @media print {
            @page { margin: 0.75in; size: letter; }
            .page-break { page-break-before: always; }
            .no-break { page-break-inside: avoid; }
        }
        * { box-sizing: border-box; }
        body {
            font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
            padding: 0;
            margin: 0;
            color: #333;
            background: #fff;
            font-size: 11pt;
            line-height: 1.4;
        }
        .header {
            background: linear-gradient(135deg, #1a1a00 0%, #0d0d0d 100%);
            color: #ffd700;
            padding: 30px 40px;
            margin-bottom: 30px;
            border-bottom: 4px solid #ffd700;
        }
        .header h1 {
            margin: 0 0 10px 0;
            font-size: 28pt;
            font-weight: 300;
            letter-spacing: 1px;
            color: #ffd700;
        }
        .header .subtitle {
            font-size: 12pt;
            opacity: 0.8;
            margin-bottom: 20px;
        }
        .header-meta {
            display: flex;
            gap: 40px;
            font-size: 10pt;
        }
        .header-meta-item { display: flex; flex-direction: column; }
        .header-meta-label { opacity: 0.6; font-size: 9pt; text-transform: uppercase; letter-spacing: 0.5px; }
        .header-meta-value { font-size: 14pt; font-weight: 600; }
        
        .content { padding: 0 40px 40px 40px; }
        
        h2 {
            color: #333;
            font-size: 14pt;
            font-weight: 600;
            margin: 30px 0 15px 0;
            padding-bottom: 8px;
            border-bottom: 2px solid #ffd700;
        }
        h3 {
            color: #444;
            font-size: 12pt;
            font-weight: 600;
            margin: 20px 0 10px 0;
        }
        
        .kpi-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 20px;
            margin: 25px 0;
        }
        .kpi-card {
            background: #f8f9fa;
            border: 1px solid #e0e0e0;
            border-radius: 8px;
            padding: 20px;
            text-align: center;
        }
        .kpi-card .value {
            font-size: 24pt;
            font-weight: 700;
            color: #333;
            margin-bottom: 5px;
        }
        .kpi-card .label {
            font-size: 9pt;
            color: #666;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        
        .summary-box {
            background: #f8f9fa;
            border: 1px solid #e0e0e0;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
        }
        .summary-row {
            display: flex;
            padding: 8px 0;
            border-bottom: 1px solid #eee;
        }
        .summary-row:last-child { border-bottom: none; }
        .summary-label { flex: 0 0 180px; color: #666; font-weight: 500; }
        .summary-value { flex: 1; color: #333; }
        
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 15px 0;
            font-size: 10pt;
        }
        thead th {
            background: #333;
            color: #ffd700;
            padding: 12px 10px;
            text-align: left;
            font-weight: 500;
            font-size: 9pt;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        tbody td {
            padding: 10px;
            border-bottom: 1px solid #e0e0e0;
        }
        tbody tr:nth-child(even) { background: #f8f9fa; }
        tbody tr:hover { background: #f0f4f8; }
        tfoot th {
            background: #f8f9fa;
            padding: 12px 10px;
            font-weight: 600;
            border-top: 2px solid #ffd700;
        }
        .text-right { text-align: right; }
        .text-center { text-align: center; }
        
        .assumptions-box {
            background: linear-gradient(135deg, #fff9e6 0%, #fff5d6 100%);
            border: 1px solid #e6d9a8;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
        }
        .assumptions-box h3 {
            color: #856404;
            margin-top: 0;
        }
        .assumptions-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 15px;
        }
        .assumption-item {
            display: flex;
            justify-content: space-between;
            padding: 8px 12px;
            background: rgba(255,255,255,0.7);
            border-radius: 4px;
        }
        .assumption-label { color: #666; }
        .assumption-value { font-weight: 600; color: #333; }
        
        .complexity-badge {
            display: inline-block;
            padding: 3px 8px;
            border-radius: 4px;
            font-size: 9pt;
            font-weight: 500;
        }
        .complexity-low { background: #d4edda; color: #155724; }
        .complexity-medium { background: #fff3cd; color: #856404; }
        .complexity-high { background: #f8d7da; color: #721c24; }
        
        .chart-section {
            margin: 25px 0;
            padding: 20px;
            background: #f8f9fa;
            border-radius: 8px;
        }
        .chart-section img {
            max-width: 100%;
            height: auto;
            border-radius: 4px;
        }
        .chart-legend {
            display: flex;
            gap: 30px;
            margin-top: 15px;
            font-size: 10pt;
            color: #666;
        }
        
        /* Gantt chart print styles */
        .gantt-header { display: flex; background: #333; color: #ffd700; font-size: 9pt; border-radius: 4px 4px 0 0; }
        .gantt-header-label { width: 150px; padding: 8px 12px; font-weight: 500; }
        .gantt-header-months { display: flex; flex: 1; }
        .gantt-month { flex: 1; padding: 8px 4px; text-align: center; border-left: 1px solid rgba(255,255,255,0.2); font-size: 8pt; }
        .gantt-row { display: flex; background: #fff; border-bottom: 1px solid #e0e0e0; min-height: 28px; }
        .gantt-row-label { width: 150px; padding: 6px 12px; font-weight: 500; background: #f8f9fa; border-right: 1px solid #e0e0e0; font-size: 10pt; }
        .gantt-row-timeline { display: flex; flex: 1; position: relative; align-items: center; }
        .gantt-bar { height: 16px; border-radius: 3px; position: absolute; }
        .gantt-bar.discipline { background: linear-gradient(90deg, #4a90d9, #357abd); }
        .gantt-bar.package { background: linear-gradient(90deg, #ffd700, #e6c200); height: 10px; }
        .gantt-packages { display: none; }
        .gantt-package-row { display: flex; background: #fafafa; border-bottom: 1px solid #eee; min-height: 24px; }
        .gantt-package-label { width: 150px; padding: 4px 12px 4px 24px; font-size: 9pt; background: #fafafa; border-right: 1px solid #e0e0e0; }
        .gantt-no-data { padding: 30px; text-align: center; color: #888; font-style: italic; }
        .gantt-legend { display: flex; gap: 30px; margin-top: 15px; font-size: 10pt; }
        .gantt-legend-item { display: flex; align-items: center; gap: 8px; }
        .gantt-legend-color { width: 24px; height: 12px; border-radius: 3px; }
        .gantt-legend-color.discipline { background: linear-gradient(90deg, #4a90d9, #357abd); }
        .gantt-legend-color.package { background: linear-gradient(90deg, #ffd700, #e6c200); }
        
        .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #e0e0e0;
            font-size: 9pt;
            color: #888;
            text-align: center;
        }
        
        .scope-section {
            background: #fffef0;
            border: 1px solid #e6d9a8;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
        }
        .scope-section h3 { color: #856404; margin-top: 0; }
        .scope-text { color: #444; line-height: 1.6; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Project Cost Estimate Report</h1>
        <div class="subtitle">Work Breakdown Structure Analysis</div>
        <div class="header-meta">
            <div class="header-meta-item">
                <span class="header-meta-label">Report Date</span>
                <span class="header-meta-value">${today}</span>
            </div>
            <div class="header-meta-item">
                <span class="header-meta-label">Total Budget</span>
                <span class="header-meta-value">${formatCurrency(calculateTotalBudget())}</span>
            </div>
            <div class="header-meta-item">
                <span class="header-meta-label">Project Duration</span>
                <span class="header-meta-value">${minDate && maxDate ? minDate + ' to ' + maxDate : 'Not Set'}</span>
            </div>
        </div>
    </div>
    
    <div class="content">
        <div class="kpi-grid">
            <div class="kpi-card">
                <div class="value">${formatCurrency(calculateTotalBudget())}</div>
                <div class="label">Total Design Fee</div>
            </div>
            <div class="kpi-card">
                <div class="value">${projectData.disciplines.length}</div>
                <div class="label">Disciplines</div>
            </div>
            <div class="kpi-card">
                <div class="value">${projectData.phases.length}</div>
                <div class="label">Project Phases</div>
            </div>
            <div class="kpi-card">
                <div class="value">${projectData.packages.length}</div>
                <div class="label">Deliverable Packages</div>
            </div>
        </div>
`;

        // Add Project Scope if available
        if (projectData.projectScope) {
            html += `
        <div class="scope-section no-break">
            <h3>Project Scope</h3>
            <div class="scope-text">${projectData.projectScope.replace(/\n/g, '<br>')}</div>
        </div>
`;
        }

        // Cost Estimate Assumptions
        if (assumptions.isCalculated) {
            html += `
        <div class="assumptions-box no-break">
            <h3>📊 Cost Estimate Assumptions</h3>
            <div class="assumptions-grid">
                <div class="assumption-item">
                    <span class="assumption-label">Construction Cost</span>
                    <span class="assumption-value">${formatCurrency(assumptions.constructionCost)}</span>
                </div>
                <div class="assumption-item">
                    <span class="assumption-label">Design Fee Percentage</span>
                    <span class="assumption-value">${assumptions.designFeePercent}%</span>
                </div>
                <div class="assumption-item">
                    <span class="assumption-label">Total Design Fee</span>
                    <span class="assumption-value">${formatCurrency(assumptions.totalDesignFee)}</span>
                </div>
                <div class="assumption-item">
                    <span class="assumption-label">Project Type</span>
                    <span class="assumption-value">${assumptions.projectType}</span>
                </div>
            </div>
            <p style="margin: 15px 0 0 0; font-size: 9pt; color: #666;">
                Budget allocations are based on industry-standard distribution percentages for ${assumptions.projectType} projects, 
                adjusted for complexity levels assigned to each discipline.
            </p>
        </div>
`;
        }

        html += `
        <h2>Discipline Budget Breakdown</h2>
        <table>
            <thead>
                <tr>
                    <th>Discipline</th>
                    <th class="text-center">Complexity</th>
                    <th class="text-right">Industry %</th>
                    <th class="text-right">Actual %</th>
                    <th class="text-right">Budget</th>
                    <th class="text-center">Notes</th>
                </tr>
            </thead>
            <tbody>
`;
        
        const totalBudget = calculateTotalBudget();
        assumptions.disciplines.forEach(disc => {
            const complexityClass = disc.complexity.toLowerCase();
            const notes = [];
            if (disc.hasComplexityOverride) notes.push('Complexity Override');
            if (disc.isManualEdit) notes.push('Manual Edit');
            
            html += `
                <tr>
                    <td><strong>${disc.name}</strong></td>
                    <td class="text-center"><span class="complexity-badge complexity-${complexityClass}">${disc.complexity}</span></td>
                    <td class="text-right">${disc.industryBasePct}%</td>
                    <td class="text-right">${disc.percentOfTotal}%</td>
                    <td class="text-right"><strong>${formatCurrency(disc.budget)}</strong></td>
                    <td class="text-center" style="font-size: 9pt; color: #888;">${notes.join(', ') || '—'}</td>
                </tr>`;
        });
        
        html += `
            </tbody>
            <tfoot>
                <tr>
                    <th colspan="3">Total</th>
                    <th class="text-right">100%</th>
                    <th class="text-right">${formatCurrency(totalBudget)}</th>
                    <th></th>
                </tr>
            </tfoot>
        </table>
        
        <div class="summary-box no-break">
            <div class="summary-row">
                <span class="summary-label">Project Phases</span>
                <span class="summary-value">${projectData.phases.join(', ')}</span>
            </div>
            <div class="summary-row">
                <span class="summary-label">Deliverable Packages</span>
                <span class="summary-value">${projectData.packages.join(', ')}</span>
            </div>
            <div class="summary-row">
                <span class="summary-label">Selected Disciplines</span>
                <span class="summary-value">${projectData.disciplines.join(', ')}</span>
            </div>
        </div>
`;

        // Add Performance Chart
        if (performanceChartImg) {
            html += `
        <div class="page-break"></div>
        <h2>Budget Distribution Over Time</h2>
        <div class="chart-section">
            <img src="${performanceChartImg}" alt="Performance Chart" />
            <div class="chart-legend">
                <span>━━ <strong>BCWS</strong> - Budgeted Cost of Work Scheduled (Planned Value)</span>
            </div>
        </div>
`;
        }
        
        // Add Gantt Chart
        if (ganttHtml && !ganttHtml.includes('No schedule data')) {
            html += `
        <h2>Project Schedule</h2>
        <div class="chart-section">
            ${ganttHtml}
            <div class="gantt-legend">
                <div class="gantt-legend-item">
                    <div class="gantt-legend-color discipline"></div>
                    <span>Discipline Timeline</span>
                </div>
                <div class="gantt-legend-item">
                    <div class="gantt-legend-color package"></div>
                    <span>Package Deliverable</span>
                </div>
            </div>
        </div>
`;
        }

        html += `
        <div class="page-break"></div>
        <h2>Complete Work Breakdown Structure</h2>
        <table>
            <thead>
                <tr>
                    <th style="width: 60px;">WBS #</th>
                    <th>Phase</th>
                    <th>Discipline</th>
                    <th>Package</th>
                    <th class="text-right" style="width: 100px;">Budget</th>
                    <th class="text-center" style="width: 60px;">Claim %</th>
                    <th style="width: 90px;">Start</th>
                    <th style="width: 90px;">End</th>
                </tr>
            </thead>
            <tbody>
`;
        
        let grandTotal = 0;
        projectData.phases.forEach((phase, pi) => {
            projectData.disciplines.forEach((discipline, di) => {
                const discBudget = projectData.budgets[discipline] || 0;
                projectData.packages.forEach((packageName, ki) => {
                    const key = `${discipline}-${packageName}`;
                    const claimPct = projectData.claiming[key] || 0;
                    const pkgBudget = discBudget * (claimPct / 100);
                    const dates = projectData.dates[key] || { start: '—', end: '—' };
                    const wbs = `${pi+1}.${di+1}.${ki+1}`;
                    grandTotal += pkgBudget;
                    
                    html += `
                <tr>
                    <td><strong>${wbs}</strong></td>
                    <td>${phase}</td>
                    <td>${discipline}</td>
                    <td>${packageName}</td>
                    <td class="text-right">${formatCurrency(pkgBudget)}</td>
                    <td class="text-center">${claimPct}%</td>
                    <td>${dates.start || '—'}</td>
                    <td>${dates.end || '—'}</td>
                </tr>`;
                });
            });
        });
        
        html += `
            </tbody>
            <tfoot>
                <tr>
                    <th colspan="4">Grand Total</th>
                    <th class="text-right">${formatCurrency(grandTotal)}</th>
                    <th colspan="3"></th>
                </tr>
            </tfoot>
        </table>
        
        <div class="footer">
            Generated by WBS Terminal • ${today} • Industry-standard cost distributions based on ${assumptions.projectType} project benchmarks
        </div>
    </div>
</body>
</html>`;
            
            // Create a temporary container for PDF generation
            const container = document.createElement('div');
            container.innerHTML = html;
            document.body.appendChild(container);
            
            // Configure PDF options
            const filename = `comprehensive_report_${new Date().toISOString().split('T')[0]}.pdf`;
            const opt = {
                margin: [0.3, 0.3, 0.3, 0.3],
                filename: filename,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { 
                    scale: 2, 
                    useCORS: true,
                    letterRendering: true,
                    willReadFrequently: true
                },
                jsPDF: { 
                    unit: 'in', 
                    format: 'letter', 
                    orientation: 'portrait' 
                },
                pagebreak: { mode: ['css', 'legacy'] }
            };
            
            // Use outputPdf to get blob, then trigger download with correct filename
            html2pdf().set(opt).from(container).outputPdf('blob').then(blob => {
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                document.body.removeChild(container);
            }).catch(err => {
                console.error('PDF generation failed:', err);
                document.body.removeChild(container);
                // Fallback to print dialog
                const printWindow = window.open('', '_blank');
                printWindow.document.write(html);
                printWindow.document.close();
                printWindow.focus();
                setTimeout(() => printWindow.print(), 500);
            });
        }

        /**
         * Calculates total budget from projectData
         * @returns {number} Total budget amount
         */
        function calculateTotalBudget() {
            return Object.values(projectData.budgets).reduce((sum, val) => sum + (val || 0), 0);
        }

        /**
         * Formats number as currency string
         * @param {number} amount - Amount to format
         * @returns {string} Formatted currency string
         */
        // formatCurrency is defined earlier in the file

        // ============================================
        // GANTT CHART
        // ============================================

        const ganttState = {
            expandedDisciplines: new Set()
        };

        /**
         * Builds and renders the Gantt chart
         */
        function buildGanttChart() {
            const container = document.getElementById('gantt-container');
            
            // Get all dates to determine timeline range
            const allDates = [];
            Object.values(projectData.dates).forEach(d => {
                if (d.start) allDates.push(new Date(d.start));
                if (d.end) allDates.push(new Date(d.end));
            });
            
            if (allDates.length === 0) {
                container.innerHTML = '<div class="gantt-no-data">No schedule data available. Please set dates in Step 6.</div>';
                return;
            }
            
            // Find min and max dates
            const minDate = new Date(Math.min(...allDates));
            const maxDate = new Date(Math.max(...allDates));
            
            // Extend range by 1 month on each side
            minDate.setDate(1);
            maxDate.setMonth(maxDate.getMonth() + 1);
            maxDate.setDate(0);
            
            // Generate months array
            const months = [];
            const currentDate = new Date(minDate);
            while (currentDate <= maxDate) {
                months.push({
                    date: new Date(currentDate),
                    label: currentDate.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
                });
                currentDate.setMonth(currentDate.getMonth() + 1);
            }
            
            // Today marker
            const today = new Date();
            const todayMonthIndex = months.findIndex(m => 
                m.date.getMonth() === today.getMonth() && 
                m.date.getFullYear() === today.getFullYear()
            );
            
            // Build discipline schedule data
            const disciplineSchedules = projectData.disciplines.map(discipline => {
                const packages = projectData.packages.map(pkg => {
                    const key = `${discipline}-${pkg}`;
                    const dates = projectData.dates[key] || {};
                    return {
                        name: pkg,
                        start: dates.start ? new Date(dates.start) : null,
                        end: dates.end ? new Date(dates.end) : null,
                        claiming: projectData.claiming[key] || 0
                    };
                }).filter(p => p.start && p.end);
                
                // Calculate discipline overall timeline
                const pkgDates = packages.flatMap(p => [p.start, p.end]).filter(d => d);
                const discStart = pkgDates.length > 0 ? new Date(Math.min(...pkgDates)) : null;
                const discEnd = pkgDates.length > 0 ? new Date(Math.max(...pkgDates)) : null;
                
                return {
                    name: discipline,
                    start: discStart,
                    end: discEnd,
                    packages: packages,
                    budget: projectData.budgets[discipline] || 0
                };
            }).filter(d => d.start && d.end);
            
            // Render
            let html = `
                <div class="gantt-chart">
                    <div class="gantt-header">
                        <div class="gantt-label-col">Discipline / Package</div>
                        <div class="gantt-timeline-header">
                            ${months.map((m, i) => `
                                <div class="gantt-month ${i === todayMonthIndex ? 'current' : ''}">${m.label}</div>
                            `).join('')}
                        </div>
                    </div>
                    <div class="gantt-body">
            `;
            
            disciplineSchedules.forEach(disc => {
                const isExpanded = ganttState.expandedDisciplines.has(disc.name);
                
                // Discipline row
                html += `
                    <div class="gantt-row discipline-row" onclick="toggleGanttDiscipline('${disc.name}')">
                        <div class="gantt-row-label">
                            <span class="gantt-expand-icon ${isExpanded ? 'expanded' : ''}">▶</span>
                            <span>${disc.name}</span>
                        </div>
                        <div class="gantt-row-timeline">
                            ${months.map((m, i) => `<div class="gantt-cell ${i === todayMonthIndex ? 'current' : ''}"></div>`).join('')}
                            <div class="gantt-bar-container">
                                ${renderGanttBar(disc, minDate, maxDate, months.length, true)}
                            </div>
                        </div>
                    </div>
                `;
                
                // Package rows
                disc.packages.forEach(pkg => {
                    html += `
                        <div class="gantt-row package-row ${isExpanded ? '' : 'hidden'}" data-discipline="${disc.name}">
                            <div class="gantt-row-label">
                                <span>${pkg.name}</span>
                            </div>
                            <div class="gantt-row-timeline">
                                ${months.map((m, i) => `<div class="gantt-cell ${i === todayMonthIndex ? 'current' : ''}"></div>`).join('')}
                                <div class="gantt-bar-container">
                                    ${renderGanttBar(pkg, minDate, maxDate, months.length, false)}
                                </div>
                            </div>
                        </div>
                    `;
                });
            });
            
            html += `
                    </div>
                </div>
                <div id="gantt-tooltip" class="gantt-tooltip"></div>
            `;
            
            container.innerHTML = html;
            
            // Add tooltip event listeners
            container.querySelectorAll('.gantt-bar').forEach(bar => {
                bar.addEventListener('mouseenter', showGanttTooltip);
                bar.addEventListener('mouseleave', hideGanttTooltip);
                bar.addEventListener('mousemove', moveGanttTooltip);
            });
        }

        /**
         * Renders a Gantt bar for a discipline or package
         */
        function renderGanttBar(item, minDate, maxDate, monthCount, isDiscipline) {
            if (!item.start || !item.end) return '';
            
            const totalDays = (maxDate - minDate) / (1000 * 60 * 60 * 24);
            const startOffset = (item.start - minDate) / (1000 * 60 * 60 * 24);
            const duration = (item.end - item.start) / (1000 * 60 * 60 * 24);
            
            const leftPercent = (startOffset / totalDays) * 100;
            const widthPercent = (duration / totalDays) * 100;
            
            const barClass = isDiscipline ? 'discipline-bar' : 'package-bar';
            const label = isDiscipline ? item.name : `${item.claiming}%`;
            
            const startStr = item.start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            const endStr = item.end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            const durationDays = Math.ceil(duration);
            
            return `
                <div class="gantt-bar ${barClass}" 
                     style="left: ${leftPercent}%; width: ${Math.max(widthPercent, 2)}%;"
                     data-name="${item.name}"
                     data-start="${startStr}"
                     data-end="${endStr}"
                     data-duration="${durationDays}"
                     data-budget="${item.budget || ''}"
                     data-claiming="${item.claiming || ''}"
                     data-is-discipline="${isDiscipline}">
                    ${widthPercent > 8 ? label : ''}
                </div>
            `;
        }

        /**
         * Toggles a discipline's expanded state in the Gantt chart
         */
        function toggleGanttDiscipline(discipline) {
            if (ganttState.expandedDisciplines.has(discipline)) {
                ganttState.expandedDisciplines.delete(discipline);
            } else {
                ganttState.expandedDisciplines.add(discipline);
            }
            
            // Toggle visibility of package rows
            document.querySelectorAll(`.package-row[data-discipline="${discipline}"]`).forEach(row => {
                row.classList.toggle('hidden');
            });
            
            // Toggle expand icon
            const discRow = document.querySelector(`.discipline-row .gantt-row-label span:last-child`);
            document.querySelectorAll('.discipline-row').forEach(row => {
                const label = row.querySelector('.gantt-row-label span:last-child');
                if (label && label.textContent === discipline) {
                    const icon = row.querySelector('.gantt-expand-icon');
                    icon.classList.toggle('expanded');
                }
            });
        }

        /**
         * Expands all disciplines in the Gantt chart
         */
        function expandAllGantt() {
            projectData.disciplines.forEach(disc => {
                ganttState.expandedDisciplines.add(disc);
            });
            document.querySelectorAll('.package-row').forEach(row => row.classList.remove('hidden'));
            document.querySelectorAll('.gantt-expand-icon').forEach(icon => icon.classList.add('expanded'));
        }

        /**
         * Collapses all disciplines in the Gantt chart
         */
        function collapseAllGantt() {
            ganttState.expandedDisciplines.clear();
            document.querySelectorAll('.package-row').forEach(row => row.classList.add('hidden'));
            document.querySelectorAll('.gantt-expand-icon').forEach(icon => icon.classList.remove('expanded'));
        }

        /**
         * Shows the Gantt tooltip
         */
        function showGanttTooltip(e) {
            const bar = e.target;
            const tooltip = document.getElementById('gantt-tooltip');
            const isDiscipline = bar.dataset.isDiscipline === 'true';
            
            let content = `<div class="gantt-tooltip-title">${bar.dataset.name}</div>`;
            content += `<div class="gantt-tooltip-row"><span class="gantt-tooltip-label">Start:</span> ${bar.dataset.start}</div>`;
            content += `<div class="gantt-tooltip-row"><span class="gantt-tooltip-label">End:</span> ${bar.dataset.end}</div>`;
            content += `<div class="gantt-tooltip-row"><span class="gantt-tooltip-label">Duration:</span> ${bar.dataset.duration} days</div>`;
            
            if (isDiscipline && bar.dataset.budget) {
                content += `<div class="gantt-tooltip-row"><span class="gantt-tooltip-label">Budget:</span> ${formatCurrency(parseFloat(bar.dataset.budget))}</div>`;
            }
            
            if (!isDiscipline && bar.dataset.claiming) {
                content += `<div class="gantt-tooltip-row"><span class="gantt-tooltip-label">Claiming:</span> ${bar.dataset.claiming}%</div>`;
            }
            
            tooltip.innerHTML = content;
            tooltip.classList.add('visible');
        }

        /**
         * Hides the Gantt tooltip
         */
        function hideGanttTooltip() {
            document.getElementById('gantt-tooltip').classList.remove('visible');
        }

        /**
         * Moves the Gantt tooltip with the cursor
         */
        function moveGanttTooltip(e) {
            const tooltip = document.getElementById('gantt-tooltip');
            const container = document.getElementById('gantt-container');
            const containerRect = container.getBoundingClientRect();
            
            let x = e.clientX - containerRect.left + 15;
            let y = e.clientY - containerRect.top - 10;
            
            // Keep tooltip within container
            const tooltipRect = tooltip.getBoundingClientRect();
            if (x + tooltipRect.width > containerRect.width) {
                x = e.clientX - containerRect.left - tooltipRect.width - 15;
            }
            
            tooltip.style.left = x + 'px';
            tooltip.style.top = y + 'px';
        }

        // ============================================
        // AI CHAT ASSISTANT
        // ============================================

        const chatState = {
            isOpen: false,
            messages: [],
            isLoading: false,
            isDragging: false,
            dragOffset: { x: 0, y: 0 }
        };

        const STEP_NAMES = {
            1: 'Phases',
            2: 'Disciplines', 
            3: 'Packages',
            4: 'Budget',
            5: 'Claiming',
            6: 'Schedule'
        };

        const STEP_DESCRIPTIONS = {
            1: 'Define project phases (e.g., Base, ESDC, TSCD). These represent major project milestones or stages.',
            2: 'Select engineering disciplines involved in the project (e.g., Structures, Civil, Traffic).',
            3: 'Define deliverable packages/milestones (e.g., Preliminary, Interim, Final, RFC).',
            4: 'Set the total budget allocation per discipline. Use the cost estimator to calculate based on construction cost and industry standards.',
            5: 'Set claiming percentages per package for each discipline. Must total 100% per discipline.',
            6: 'Set start and end dates for each package delivery.'
        };

        /**
         * Gathers current application context for the AI assistant
         * @returns {object} Context object with current state information
         */
        function getChatContext() {
            const resultsVisible = !document.getElementById('results-section').classList.contains('hidden');
            
            let context = {
                currentView: resultsVisible ? 'Results/WBS View' : `Step ${currentStep}: ${STEP_NAMES[currentStep]}`,
                stepDescription: resultsVisible ? 'Viewing generated WBS table, Gantt chart, KPIs, and performance chart.' : STEP_DESCRIPTIONS[currentStep],
                projectData: {
                    phases: projectData.phases.length > 0 ? projectData.phases : ['(not yet defined)'],
                    disciplines: projectData.disciplines.length > 0 ? projectData.disciplines : ['(not yet selected)'],
                    packages: projectData.packages.length > 0 ? projectData.packages : ['(not yet defined)'],
                    totalBudget: formatCurrency(calculateTotalBudget()),
                    budgetsByDiscipline: projectData.budgets,
                    claimingScheme: projectData.claiming,
                    scheduleDates: projectData.dates
                }
            };

            // Add results-specific context when viewing WBS output
            if (resultsVisible) {
                context.wbsResults = generateWBSDataForChat();
            }

            // Add step-specific context
            if (!resultsVisible) {
                switch (currentStep) {
                    case 4:
                        context.calculatorSettings = {
                            constructionCost: document.getElementById('calc-construction-cost')?.value || 0,
                            designFeePercent: document.getElementById('calc-design-fee-pct')?.value || 15,
                            projectType: document.getElementById('calc-project-type')?.value || 'Highway/Roadway',
                            complexity: document.getElementById('calc-global-complexity')?.value || 'Medium'
                        };
                        break;
                    case 5:
                        // Check claiming totals
                        const claimingTotals = {};
                        projectData.disciplines.forEach(disc => {
                            let total = 0;
                            projectData.packages.forEach(pkg => {
                                total += projectData.claiming[`${disc}-${pkg}`] || 0;
                            });
                            claimingTotals[disc] = total;
                        });
                        context.claimingTotals = claimingTotals;
                        break;
                }
            }

            return context;
        }

        /**
         * Generates structured WBS data for the chatbot
         * @returns {object} WBS results data
         */
        function generateWBSDataForChat() {
            const wbsElements = [];
            let grandTotal = 0;
            let minDate = null, maxDate = null;
            
            // Generate all WBS elements
            projectData.phases.forEach((phase, pi) => {
                projectData.disciplines.forEach((discipline, di) => {
                    const discBudget = projectData.budgets[discipline] || 0;
                    let discMinDate = null, discMaxDate = null;
                    
                    projectData.packages.forEach((pkg, ki) => {
                        const key = `${discipline}-${pkg}`;
                        const claimPct = projectData.claiming[key] || 0;
                        const pkgBudget = discBudget * (claimPct / 100);
                        const dates = projectData.dates[key] || { start: null, end: null };
                        
                        grandTotal += pkgBudget;
                        
                        // Track dates
                        if (dates.start) {
                            if (!minDate || dates.start < minDate) minDate = dates.start;
                            if (!discMinDate || dates.start < discMinDate) discMinDate = dates.start;
                        }
                        if (dates.end) {
                            if (!maxDate || dates.end > maxDate) maxDate = dates.end;
                            if (!discMaxDate || dates.end > discMaxDate) discMaxDate = dates.end;
                        }
                        
                        wbsElements.push({
                            wbs: `${pi+1}.${di+1}.${ki+1}`,
                            phase,
                            discipline,
                            package: pkg,
                            budget: pkgBudget,
                            claimPercent: claimPct,
                            startDate: dates.start || 'Not set',
                            endDate: dates.end || 'Not set'
                        });
                    });
                });
            });
            
            // Calculate discipline summaries
            const disciplineSummaries = projectData.disciplines.map(disc => {
                const budget = projectData.budgets[disc] || 0;
                const percentage = grandTotal > 0 ? ((budget / grandTotal) * 100).toFixed(1) : 0;
                
                // Get date range for discipline
                let discStart = null, discEnd = null;
                projectData.packages.forEach(pkg => {
                    const key = `${disc}-${pkg}`;
                    const dates = projectData.dates[key];
                    if (dates) {
                        if (dates.start && (!discStart || dates.start < discStart)) discStart = dates.start;
                        if (dates.end && (!discEnd || dates.end > discEnd)) discEnd = dates.end;
                    }
                });
                
                return {
                    name: disc,
                    totalBudget: budget,
                    percentOfTotal: percentage + '%',
                    startDate: discStart || 'Not set',
                    endDate: discEnd || 'Not set',
                    packageCount: projectData.packages.length
                };
            });
            
            // Calculate project duration
            let projectDuration = 0;
            if (minDate && maxDate) {
                projectDuration = Math.ceil((new Date(maxDate) - new Date(minDate)) / (1000 * 60 * 60 * 24));
            }
            
            return {
                kpis: {
                    totalBudget: formatCurrency(grandTotal),
                    totalBudgetRaw: grandTotal,
                    wbsElementCount: wbsElements.length,
                    disciplineCount: projectData.disciplines.length,
                    phaseCount: projectData.phases.length,
                    packageCount: projectData.packages.length,
                    projectStartDate: minDate || 'Not set',
                    projectEndDate: maxDate || 'Not set',
                    projectDurationDays: projectDuration,
                    projectDurationMonths: Math.ceil(projectDuration / 30)
                },
                disciplineSummaries,
                        wbsElements: wbsElements, // Include all elements
                        totalWbsElements: wbsElements.length,
                        // Include raw data for calculations
                        rawData: {
                            grandTotal,
                            claiming: projectData.claiming,
                            dates: projectData.dates,
                            budgets: projectData.budgets
                        }
            };
        }

        /**
         * Builds the system prompt for the AI assistant
         * @returns {string} System prompt with context
         */
        function buildSystemPrompt() {
            const context = getChatContext();
            
            let prompt = `You are a helpful AI assistant embedded in WBS Terminal v1.0, a Work Breakdown Structure (WBS) generator for engineering projects.

## Your Role
- Help users understand and use the current screen/step they're viewing
- Answer questions about WBS concepts, engineering project planning, and budgeting
- Provide guidance specific to their current context and data
- Perform calculations, forecasting, and analysis when asked
- Be concise but thorough; use bullet points for lists
- Reference specific values from their project when relevant
- When on the Results page, you have FULL ACCESS to all project data for detailed analysis

## Current User Context
**View:** ${context.currentView}
**Description:** ${context.stepDescription}

## Project Data
- **Phases:** ${context.projectData.phases.join(', ')}
- **Disciplines:** ${context.projectData.disciplines.join(', ')}
- **Packages:** ${context.projectData.packages.join(', ')}
- **Total Budget:** ${context.projectData.totalBudget}
${Object.keys(context.projectData.budgetsByDiscipline).length > 0 ? `- **Budget Breakdown:** ${Object.entries(context.projectData.budgetsByDiscipline).map(([k, v]) => `${k}: ${formatCurrency(v)}`).join(', ')}` : ''}
`;

            // Add project scope if available
            if (projectData.projectScope) {
                prompt += `
## PROJECT SCOPE
${projectData.projectScope}
`;
            }
            
            // Add schedule notes if available
            if (projectData.scheduleNotes) {
                prompt += `
## SCHEDULE NOTES
${projectData.scheduleNotes}
`;
            }

            // Add WBS Results data when on results page
            if (context.wbsResults) {
                const r = context.wbsResults;
                prompt += `
## PROJECT KPIs (Generated Results)
- **Total Project Budget:** ${r.kpis.totalBudget} (raw: $${r.rawData.grandTotal.toFixed(2)})
- **Total WBS Elements:** ${r.kpis.wbsElementCount}
- **Disciplines:** ${r.kpis.disciplineCount}
- **Phases:** ${r.kpis.phaseCount}
- **Packages per Discipline:** ${r.kpis.packageCount}
- **Project Start Date:** ${r.kpis.projectStartDate}
- **Project End Date:** ${r.kpis.projectEndDate}
- **Project Duration:** ${r.kpis.projectDurationDays} days (~${r.kpis.projectDurationMonths} months)

## DISCIPLINE BREAKDOWN (with Scope of Work)
${r.disciplineSummaries.map(d => {
    const scope = projectData.disciplineScopes && projectData.disciplineScopes[d.name] ? projectData.disciplineScopes[d.name] : 'No scope defined';
    const rawBudget = projectData.budgets[d.name] || 0;
    return `### ${d.name}
- Budget: ${formatCurrency(d.totalBudget)} (raw: $${rawBudget})
- Percentage: ${d.percentOfTotal} of total
- Timeline: ${d.startDate} to ${d.endDate}
- Packages: ${d.packageCount}
- Scope: ${scope}`;
}).join('\n\n')}

## COMPLETE CLAIMING PERCENTAGES (Discipline → Package → %)
${projectData.disciplines.map(disc => {
    const claims = projectData.packages.map(pkg => {
        const key = `${disc}-${pkg}`;
        return `${pkg}: ${projectData.claiming[key] || 0}%`;
    }).join(', ');
    return `- ${disc}: ${claims}`;
}).join('\n')}

## COMPLETE DATE SCHEDULE (Discipline → Package → Start/End)
${projectData.disciplines.map(disc => {
    const dates = projectData.packages.map(pkg => {
        const key = `${disc}-${pkg}`;
        const d = projectData.dates[key] || {};
        return `${pkg}: ${d.start || 'N/A'} to ${d.end || 'N/A'}`;
    }).join('; ');
    return `- ${disc}: ${dates}`;
}).join('\n')}

## ALL WBS ELEMENTS (${r.totalWbsElements} total)
Format: WBS | Phase | Discipline | Package | Budget | Claim% | Start | End
${r.wbsElements.map(w => `${w.wbs} | ${w.phase} | ${w.discipline} | ${w.package} | $${w.budget.toFixed(2)} | ${w.claimPercent}% | ${w.startDate} | ${w.endDate}`).join('\n')}

## RAW BUDGET DATA (for calculations)
${Object.entries(projectData.budgets).map(([disc, budget]) => `${disc}: $${budget}`).join('\n')}

## ANALYSIS CAPABILITIES
You can help with:
- Budget breakdowns by discipline, phase, or package
- Schedule analysis (overlaps, critical path, gaps)
- Forecasting (burn rate, monthly spend, cash flow)
- Comparisons between disciplines
- Claiming percentage analysis
- What-if scenarios (e.g., "what if we increase Civil by 10%?")
- Monthly/quarterly cost distribution
- Resource loading analysis
- Risk identification based on schedule/budget
- Earned value calculations (if given actuals)
`;
            } else {
                prompt += `
## Application Overview (6-Step Wizard)
1. **PHASES** - Define project phases (Base, ESDC, TSCD, etc.)
2. **DISCIPLINES** - Select engineering disciplines (Structures, Civil, Traffic, etc.)
3. **PACKAGES** - Define deliverable milestones (Preliminary, Interim, Final, RFC)
4. **BUDGET** - Set budget per discipline; includes cost estimator with industry percentages
5. **CLAIMING** - Set claiming % per package (must total 100% per discipline)
6. **SCHEDULE** - Set start/end dates for each package

## Tips for Each Step
- Step 1: Phases should represent major project stages or milestones
- Step 2: Select all disciplines that will have budget allocations
- Step 3: Packages are typically deliverable milestones (30%, 60%, 90%, Final)
- Step 4: Use the cost estimator to calculate budgets based on construction cost and industry standards
- Step 5: Claiming percentages determine how budget is distributed across packages; must sum to 100%
- Step 6: Dates help generate the project schedule and performance charts
`;
            }

            if (context.calculatorSettings) {
                prompt += `
## Current Calculator Settings
- Construction Cost: $${parseInt(context.calculatorSettings.constructionCost).toLocaleString()}
- Design Fee: ${context.calculatorSettings.designFeePercent}%
- Project Type: ${context.calculatorSettings.projectType}
- Complexity: ${context.calculatorSettings.complexity}
`;
            }

            if (context.claimingTotals) {
                prompt += `
## Claiming Status
${Object.entries(context.claimingTotals).map(([disc, total]) => `- ${disc}: ${total}% ${total === 100 ? '✓' : `(needs ${100 - total}% more)`}`).join('\n')}
`;
            }

            prompt += `
Be helpful, friendly, and context-aware. When users are on the Results page, you have access to all the generated WBS data and can answer specific questions about budgets, schedules, disciplines, and packages.`;

            return prompt;
        }

        /**
         * Toggles the chat panel open/closed
         */
        function toggleChat() {
            chatState.isOpen = !chatState.isOpen;
            const panel = document.getElementById('chat-panel');
            const fab = document.getElementById('chat-fab');
            
            panel.classList.toggle('open', chatState.isOpen);
            fab.classList.remove('has-unread');
            
            if (chatState.isOpen && chatState.messages.length === 0) {
                // Check for valid API key first
                if (!getValidApiKey()) {
                    showApiKeyModal();
                } else {
                    addWelcomeMessage();
                }
            }
            
            if (chatState.isOpen) {
                setTimeout(() => {
                    document.getElementById('chat-input').focus();
                }, 300);
            }
        }

        /**
         * Adds the initial welcome message
         */
        function addWelcomeMessage() {
            const context = getChatContext();
            const resultsVisible = !document.getElementById('results-section').classList.contains('hidden');
            
            if (resultsVisible) {
                addMessage('assistant', `👋 Hi! I'm your WBS Terminal assistant. You're viewing the **Generated WBS Results**.\n\nI can **analyze your data** and **make changes** using natural language:\n\n**📊 Analysis:**\n• "Which discipline has the highest budget?"\n• "Compare Civil vs Structures budgets"\n• "Run a what-if scenario if we cut Traffic by 20%"\n\n**✏️ Editing (I can do this!):**\n• "Add $50,000 to Structures budget"\n• "Transfer 10% from Civil to Drainage"\n• "Add a new QA/QC discipline with $75,000"\n• "Extend all Final packages by 2 weeks"\n\nWhat would you like to do?`);
            } else {
                addMessage('assistant', `👋 Hi! I'm your WBS Terminal assistant. You're currently on **${context.currentView}**.\n\nAsk me anything about:\n• This step and what to do\n• Your project data\n• WBS concepts & best practices\n\n💡 **Tip:** Generate your WBS first, then I can help you edit budgets and schedules using natural language!\n\nHow can I help?`);
            }
        }

        /**
         * Shows the API key configuration modal
         */
        function showApiKeyModal() {
            document.getElementById('chat-api-modal').classList.add('open');
            document.getElementById('api-key-input').focus();
        }

        /**
         * Hides the API key modal
         */
        function hideApiKeyModal() {
            document.getElementById('chat-api-modal').classList.remove('open');
        }

        /**
         * Saves the API key to localStorage
         */
        function saveApiKey() {
            const key = document.getElementById('api-key-input').value.trim();
            
            // Validate key format
            if (!key) {
                alert('Please enter an API key.');
                return;
            }
            
            if (!key.startsWith('sk-')) {
                alert('Invalid API key format. OpenAI API keys should start with "sk-".');
                return;
            }
            
            if (key.length < 20) {
                alert('API key appears to be too short. Please check and try again.');
                return;
            }
            
            localStorage.setItem('wbs_openai_key', key);
            console.log('API Key saved:', `${key.substring(0, 7)}...${key.substring(key.length - 4)} (${key.length} chars)`);
            hideApiKeyModal();
            addWelcomeMessage();
        }
        
        /**
         * Validates the stored API key and returns it if valid
         * @returns {string|null} The API key if valid, null otherwise
         */
        function getValidApiKey() {
            const apiKey = localStorage.getItem('wbs_openai_key');
            
            // Debug logging (masked for security)
            if (apiKey) {
                console.log('API Key status:', `Present (${apiKey.length} chars, starts with "${apiKey.substring(0, 7)}...")`);
            } else {
                console.log('API Key status: MISSING or empty');
            }
            
            // Validate key exists and has correct format
            if (!apiKey || apiKey.trim() === '') {
                console.warn('API Key is missing or empty');
                return null;
            }
            
            if (!apiKey.startsWith('sk-')) {
                console.warn('API Key has invalid format (should start with sk-)');
                return null;
            }
            
            if (apiKey.length < 20) {
                console.warn('API Key is too short');
                return null;
            }
            
            return apiKey;
        }

        /**
         * Opens settings to change API key
         */
        function openChatSettings() {
            document.getElementById('api-key-input').value = localStorage.getItem('wbs_openai_key') || '';
            showApiKeyModal();
        }

        /**
         * Clears chat history
         */
        function clearChat() {
            chatState.messages = [];
            renderMessages();
            addWelcomeMessage();
        }

        /**
         * Resets chat panel to default position
         */
        function resetChatPosition() {
            const panel = document.getElementById('chat-panel');
            panel.style.right = '24px';
            panel.style.bottom = '96px';
            panel.style.left = 'auto';
            panel.style.top = 'auto';
            localStorage.removeItem('wbs_chat_position');
        }

        /**
         * Loads saved chat position from localStorage
         */
        function loadChatPosition() {
            const saved = localStorage.getItem('wbs_chat_position');
            if (saved) {
                try {
                    const pos = JSON.parse(saved);
                    const panel = document.getElementById('chat-panel');
                    // Validate position is still on screen
                    const maxX = window.innerWidth - 100;
                    const maxY = window.innerHeight - 100;
                    if (pos.x >= 0 && pos.x <= maxX && pos.y >= 0 && pos.y <= maxY) {
                        panel.style.left = pos.x + 'px';
                        panel.style.top = pos.y + 'px';
                        panel.style.right = 'auto';
                        panel.style.bottom = 'auto';
                    }
                } catch (e) {
                    // Invalid saved position, ignore
                }
            }
        }

        /**
         * Saves chat position to localStorage
         */
        function saveChatPosition() {
            const panel = document.getElementById('chat-panel');
            const rect = panel.getBoundingClientRect();
            localStorage.setItem('wbs_chat_position', JSON.stringify({
                x: rect.left,
                y: rect.top
            }));
        }

        /**
         * Handles mouse down on chat header for dragging
         * @param {MouseEvent} e
         */
        function handleChatDragStart(e) {
            // Don't drag if clicking on buttons
            if (e.target.closest('.chat-header-btn') || e.target.closest('.chat-header-actions')) {
                return;
            }
            
            const panel = document.getElementById('chat-panel');
            const rect = panel.getBoundingClientRect();
            
            chatState.isDragging = true;
            chatState.dragOffset = {
                x: e.clientX - rect.left,
                y: e.clientY - rect.top
            };
            
            panel.classList.add('dragging');
            document.addEventListener('mousemove', handleChatDrag);
            document.addEventListener('mouseup', handleChatDragEnd);
            e.preventDefault();
        }

        /**
         * Handles mouse move during drag
         * @param {MouseEvent} e
         */
        function handleChatDrag(e) {
            if (!chatState.isDragging) return;
            
            const panel = document.getElementById('chat-panel');
            const panelRect = panel.getBoundingClientRect();
            
            let newX = e.clientX - chatState.dragOffset.x;
            let newY = e.clientY - chatState.dragOffset.y;
            
            // Constrain to viewport
            const minX = 0;
            const minY = 0;
            const maxX = window.innerWidth - panelRect.width;
            const maxY = window.innerHeight - panelRect.height;
            
            newX = Math.max(minX, Math.min(newX, maxX));
            newY = Math.max(minY, Math.min(newY, maxY));
            
            panel.style.left = newX + 'px';
            panel.style.top = newY + 'px';
            panel.style.right = 'auto';
            panel.style.bottom = 'auto';
        }

        /**
         * Handles mouse up to end drag
         * @param {MouseEvent} e
         */
        function handleChatDragEnd(e) {
            if (!chatState.isDragging) return;
            
            chatState.isDragging = false;
            const panel = document.getElementById('chat-panel');
            panel.classList.remove('dragging');
            
            document.removeEventListener('mousemove', handleChatDrag);
            document.removeEventListener('mouseup', handleChatDragEnd);
            
            saveChatPosition();
        }

        /**
         * Initializes chat drag functionality
         */
        function initChatDrag() {
            const header = document.querySelector('.chat-header');
            if (header) {
                header.addEventListener('mousedown', handleChatDragStart);
            }
            loadChatPosition();
        }

        // Initialize drag when DOM is ready
        document.addEventListener('DOMContentLoaded', initChatDrag);

        /**
         * Adds a message to the chat
         * @param {string} role - 'user', 'assistant', or 'system'
         * @param {string} content - Message content
         */
        function addMessage(role, content) {
            chatState.messages.push({ role, content });
            renderMessages();
        }

        /**
         * Updates the last message in place (for streaming)
         * @param {string} content - The updated content
         */
        function updateLastMessage(content) {
            if (chatState.messages.length > 0) {
                chatState.messages[chatState.messages.length - 1].content = content;
                renderMessages();
            }
        }

        /**
         * Adds a streaming message placeholder
         * @param {string} role - The role of the message
         * @returns {number} Index of the added message
         */
        function addStreamingMessage(role) {
            chatState.messages.push({ role, content: '' });
            renderMessages();
            return chatState.messages.length - 1;
        }

        /**
         * Renders all chat messages
         */
        function renderMessages() {
            const container = document.getElementById('chat-messages');
            container.innerHTML = chatState.messages.map((msg, idx) => {
                const formattedContent = msg.content
                    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                    .replace(/`(.*?)`/g, '<code>$1</code>')
                    .replace(/\n/g, '<br>')
                    .replace(/• /g, '&bull; ');
                const isStreaming = idx === chatState.messages.length - 1 && chatState.isLoading && msg.role === 'assistant';
                const streamingClass = isStreaming ? ' streaming' : '';
                return `<div class="chat-message ${msg.role}${streamingClass}">${formattedContent || '<span class="streaming-cursor">▋</span>'}</div>`;
            }).join('');
            
            // Scroll to bottom
            container.scrollTop = container.scrollHeight;
        }

        /**
         * Shows/hides the typing indicator
         * @param {boolean} show - Whether to show the indicator
         */
        function showTypingIndicator(show) {
            const container = document.getElementById('chat-messages');
            const existing = container.querySelector('.chat-typing');
            
            if (show && !existing) {
                container.insertAdjacentHTML('beforeend', '<div class="chat-typing"><span></span><span></span><span></span></div>');
                container.scrollTop = container.scrollHeight;
            } else if (!show && existing) {
                existing.remove();
            }
        }

        // ============================================
        // NATURAL LANGUAGE WBS EDITING (TOOL CALLING)
        // ============================================

        /**
         * Tool definitions for OpenAI function calling
         */
        const chatTools = [
            {
                type: "function",
                function: {
                    name: "adjust_budget",
                    description: "Adjust a discipline's budget by setting a new amount or modifying by a percentage or fixed amount",
                    parameters: {
                        type: "object",
                        properties: {
                            discipline: {
                                type: "string",
                                description: "The name of the discipline to adjust (e.g., 'Structures', 'Civil')"
                            },
                            action: {
                                type: "string",
                                enum: ["set", "increase", "decrease", "transfer"],
                                description: "The type of adjustment: set absolute value, increase, decrease, or transfer to another discipline"
                            },
                            amount: {
                                type: "number",
                                description: "The amount to adjust (in dollars, or percentage if is_percentage is true)"
                            },
                            is_percentage: {
                                type: "boolean",
                                description: "If true, the amount is a percentage; if false, it's a dollar amount"
                            },
                            target_discipline: {
                                type: "string",
                                description: "For transfer action only: the discipline to transfer funds to"
                            }
                        },
                        required: ["discipline", "action", "amount"]
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "add_discipline",
                    description: "Add a new discipline to the project",
                    parameters: {
                        type: "object",
                        properties: {
                            name: {
                                type: "string",
                                description: "Name of the new discipline"
                            },
                            budget: {
                                type: "number",
                                description: "Initial budget for the discipline"
                            }
                        },
                        required: ["name"]
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "remove_discipline",
                    description: "Remove a discipline from the project",
                    parameters: {
                        type: "object",
                        properties: {
                            discipline: {
                                type: "string",
                                description: "Name of the discipline to remove"
                            }
                        },
                        required: ["discipline"]
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "modify_schedule",
                    description: "Modify the schedule dates for a discipline or package",
                    parameters: {
                        type: "object",
                        properties: {
                            discipline: {
                                type: "string",
                                description: "The discipline to modify (or 'all' for all disciplines)"
                            },
                            package: {
                                type: "string",
                                description: "The package to modify (or 'all' for all packages)"
                            },
                            action: {
                                type: "string",
                                enum: ["extend", "shorten", "shift", "set_start", "set_end"],
                                description: "Type of schedule modification"
                            },
                            days: {
                                type: "integer",
                                description: "Number of days to adjust (positive or negative)"
                            },
                            date: {
                                type: "string",
                                description: "For set_start/set_end: the new date (YYYY-MM-DD format)"
                            }
                        },
                        required: ["discipline", "action"]
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "run_what_if",
                    description: "Run a what-if scenario analysis showing impacts of proposed changes",
                    parameters: {
                        type: "object",
                        properties: {
                            scenario_description: {
                                type: "string",
                                description: "Description of the scenario to analyze"
                            },
                            changes: {
                                type: "array",
                                description: "List of proposed changes to analyze",
                                items: {
                                    type: "object",
                                    properties: {
                                        discipline: { type: "string" },
                                        budget_change: { type: "number" },
                                        is_percentage: { type: "boolean" }
                                    }
                                }
                            }
                        },
                        required: ["scenario_description"]
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "get_project_summary",
                    description: "Get detailed project statistics and KPIs",
                    parameters: {
                        type: "object",
                        properties: {
                            include_details: {
                                type: "boolean",
                                description: "Whether to include detailed breakdowns"
                            }
                        }
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "modify_claiming",
                    description: "Modify the claiming percentage for a discipline-package combination",
                    parameters: {
                        type: "object",
                        properties: {
                            discipline: {
                                type: "string",
                                description: "The discipline to modify (or 'all' for all disciplines)"
                            },
                            package: {
                                type: "string",
                                description: "The package to modify"
                            },
                            percentage: {
                                type: "number",
                                description: "The new claiming percentage (0-100)"
                            }
                        },
                        required: ["discipline", "package", "percentage"]
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "add_package",
                    description: "Add a new package/deliverable to the project",
                    parameters: {
                        type: "object",
                        properties: {
                            name: {
                                type: "string",
                                description: "Name of the new package (e.g., '60%', 'Quality Assurance')"
                            },
                            default_claim: {
                                type: "number",
                                description: "Default claiming percentage for this package (will be balanced across existing packages)"
                            }
                        },
                        required: ["name"]
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "add_phase",
                    description: "Add a new phase to the project",
                    parameters: {
                        type: "object",
                        properties: {
                            name: {
                                type: "string",
                                description: "Name of the new phase (e.g., 'Construction Support', 'QA/QC')"
                            }
                        },
                        required: ["name"]
                    }
                }
            }
        ];

        /**
         * Executes a tool call and returns the result
         * @param {string} name - Tool function name
         * @param {object} args - Tool arguments
         * @returns {object} Result of the tool execution
         */
        function executeToolCall(name, args) {
            try {
                let result;
                switch (name) {
                    case 'adjust_budget':
                        result = executeAdjustBudget(args);
                        break;
                    case 'add_discipline':
                        result = executeAddDiscipline(args);
                        break;
                    case 'remove_discipline':
                        result = executeRemoveDiscipline(args);
                        break;
                    case 'modify_schedule':
                        result = executeModifySchedule(args);
                        break;
                    case 'run_what_if':
                        result = executeWhatIf(args);
                        break;
                    case 'get_project_summary':
                        result = executeGetProjectSummary(args);
                        break;
                    case 'modify_claiming':
                        result = executeModifyClaiming(args);
                        break;
                    case 'add_package':
                        result = executeAddPackage(args);
                        break;
                    case 'add_phase':
                        result = executeAddPhase(args);
                        break;
                    default:
                        return { success: false, error: `Unknown tool: ${name}` };
                }
                
                // Refresh UI after successful data-modifying operations
                if (result.success && name !== 'get_project_summary' && name !== 'run_what_if') {
                    refreshUIAfterToolExecution();
                }
                
                return result;
            } catch (error) {
                return { success: false, error: error.message };
            }
        }
        
        /**
         * Modifies claiming percentage for a discipline-package combination
         */
        function executeModifyClaiming(args) {
            const { discipline, package: pkg, percentage } = args;
            
            if (percentage < 0 || percentage > 100) {
                return { success: false, error: 'Percentage must be between 0 and 100' };
            }
            
            const changes = [];
            
            if (discipline.toLowerCase() === 'all') {
                // Apply to all disciplines for this package
                projectData.disciplines.forEach(disc => {
                    const key = `${disc}-${pkg}`;
                    if (projectData.claiming[key] !== undefined) {
                        const oldValue = projectData.claiming[key];
                        projectData.claiming[key] = percentage;
                        changes.push({ discipline: disc, package: pkg, oldValue, newValue: percentage });
                    }
                });
            } else {
                const discName = projectData.disciplines.find(
                    d => d.toLowerCase() === discipline.toLowerCase()
                );
                if (!discName) {
                    return { success: false, error: `Discipline "${discipline}" not found` };
                }
                
                const key = `${discName}-${pkg}`;
                const oldValue = projectData.claiming[key] || 0;
                projectData.claiming[key] = percentage;
                changes.push({ discipline: discName, package: pkg, oldValue, newValue: percentage });
            }
            
            // Regenerate activity IDs (since they now include claiming)
            initializeUniqueIds();
            
            triggerAutosave();
            
            return {
                success: true,
                message: `Updated claiming: ${changes.map(c => `${c.discipline}/${c.package}: ${c.oldValue}% → ${c.newValue}%`).join(', ')}`,
                changes
            };
        }
        
        /**
         * Adds a new package to the project
         */
        function executeAddPackage(args) {
            const { name, default_claim = 0 } = args;
            
            if (projectData.packages.includes(name)) {
                return { success: false, error: `Package "${name}" already exists` };
            }
            
            // Add package
            projectData.packages.push(name);
            
            // Initialize claiming and dates for all disciplines
            const today = new Date();
            const pkgIndex = projectData.packages.length - 1;
            
            projectData.disciplines.forEach(disc => {
                const key = `${disc}-${name}`;
                projectData.claiming[key] = default_claim;
                
                // Initialize dates
                const startDate = new Date(today);
                startDate.setDate(startDate.getDate() + pkgIndex * 30);
                const endDate = new Date(startDate);
                endDate.setDate(endDate.getDate() + 28);
                projectData.dates[key] = {
                    start: startDate.toISOString().split('T')[0],
                    end: endDate.toISOString().split('T')[0]
                };
            });
            
            // Regenerate IDs
            initializeUniqueIds();
            
            triggerAutosave();
            
            return {
                success: true,
                message: `Added package "${name}" with ${default_claim}% default claiming`,
                package: name,
                totalPackages: projectData.packages.length
            };
        }
        
        /**
         * Adds a new phase to the project
         */
        function executeAddPhase(args) {
            const { name } = args;
            
            if (projectData.phases.includes(name)) {
                return { success: false, error: `Phase "${name}" already exists` };
            }
            
            projectData.phases.push(name);
            triggerAutosave();
            
            return {
                success: true,
                message: `Added phase "${name}"`,
                phase: name,
                totalPhases: projectData.phases.length
            };
        }
        
        /**
         * Refreshes all UI components after a tool modifies project data
         */
        function refreshUIAfterToolExecution() {
            try {
                // Check if we're on the results page
                const resultsVisible = !document.getElementById('results-section').classList.contains('hidden');
                
                if (resultsVisible) {
                    // Check if in edit mode
                    const editToolbar = document.getElementById('wbs-edit-toolbar');
                    const isEditMode = editToolbar && !editToolbar.classList.contains('hidden');
                    
                    // Rebuild WBS table
                    if (isEditMode) {
                        buildWBSTableEditable();
                    } else {
                        buildWBSTable();
                    }
                    
                    // Update other UI components
                    updateKPIs();
                    createChart();
                    buildGanttChart();
                    populateFilters();
                    
                    console.log('UI refreshed after tool execution');
                }
            } catch (error) {
                console.error('Error refreshing UI after tool execution:', error);
            }
        }

        /**
         * Adjusts a discipline's budget
         */
        function executeAdjustBudget(args) {
            const { discipline, action, amount, is_percentage, target_discipline } = args;
            
            // Find the discipline (case-insensitive)
            const discKey = Object.keys(projectData.budgets).find(
                d => d.toLowerCase() === discipline.toLowerCase()
            );
            
            if (!discKey && action !== 'set') {
                return { success: false, error: `Discipline "${discipline}" not found in project` };
            }
            
            const currentBudget = projectData.budgets[discKey] || 0;
            let newBudget = currentBudget;
            let changeAmount = is_percentage ? (currentBudget * amount / 100) : amount;
            
            switch (action) {
                case 'set':
                    newBudget = amount;
                    changeAmount = amount - currentBudget;
                    break;
                case 'increase':
                    newBudget = currentBudget + changeAmount;
                    break;
                case 'decrease':
                    newBudget = Math.max(0, currentBudget - changeAmount);
                    changeAmount = currentBudget - newBudget;
                    break;
                case 'transfer':
                    if (!target_discipline) {
                        return { success: false, error: 'Target discipline required for transfer' };
                    }
                    const targetKey = Object.keys(projectData.budgets).find(
                        d => d.toLowerCase() === target_discipline.toLowerCase()
                    );
                    if (!targetKey) {
                        return { success: false, error: `Target discipline "${target_discipline}" not found` };
                    }
                    const transferAmt = is_percentage ? (currentBudget * amount / 100) : amount;
                    projectData.budgets[discKey] = currentBudget - transferAmt;
                    projectData.budgets[targetKey] = (projectData.budgets[targetKey] || 0) + transferAmt;
                    triggerAutosave();
                    return {
                        success: true,
                        message: `Transferred $${formatNumberShort(transferAmt)} from ${discKey} to ${targetKey}`,
                        changes: {
                            [discKey]: { from: currentBudget, to: projectData.budgets[discKey] },
                            [targetKey]: { from: projectData.budgets[targetKey] - transferAmt, to: projectData.budgets[targetKey] }
                        }
                    };
            }
            
            if (discKey) {
                projectData.budgets[discKey] = newBudget;
            } else {
                // Adding new discipline with set action
                projectData.budgets[discipline] = newBudget;
                if (!projectData.disciplines.includes(discipline)) {
                    projectData.disciplines.push(discipline);
                }
            }
            
            triggerAutosave();
            
            return {
                success: true,
                message: `${action === 'set' ? 'Set' : action === 'increase' ? 'Increased' : 'Decreased'} ${discKey || discipline} budget`,
                changes: {
                    discipline: discKey || discipline,
                    previous: currentBudget,
                    new: newBudget,
                    difference: newBudget - currentBudget
                },
                newTotalBudget: Object.values(projectData.budgets).reduce((sum, b) => sum + b, 0)
            };
        }

        /**
         * Adds a new discipline to the project
         */
        function executeAddDiscipline(args) {
            const { name, budget = 0 } = args;
            
            // Check if discipline already exists
            const exists = projectData.disciplines.some(
                d => d.toLowerCase() === name.toLowerCase()
            );
            
            if (exists) {
                return { success: false, error: `Discipline "${name}" already exists` };
            }
            
            // Add discipline
            projectData.disciplines.push(name);
            projectData.budgets[name] = budget;
            
            // Initialize claiming for new discipline
            projectData.packages.forEach((pkg, i) => {
                const key = `${name}-${pkg}`;
                const claimPerPackage = Math.floor(100 / projectData.packages.length);
                const remainder = 100 - (claimPerPackage * projectData.packages.length);
                projectData.claiming[key] = claimPerPackage + (i === projectData.packages.length - 1 ? remainder : 0);
            });
            
            // Initialize dates
            const today = new Date();
            projectData.packages.forEach((pkg, i) => {
                const key = `${name}-${pkg}`;
                const startDate = new Date(today);
                startDate.setDate(startDate.getDate() + i * 30);
                const endDate = new Date(startDate);
                endDate.setDate(endDate.getDate() + 28);
                projectData.dates[key] = {
                    start: startDate.toISOString().split('T')[0],
                    end: endDate.toISOString().split('T')[0]
                };
            });
            
            triggerAutosave();
            
            return {
                success: true,
                message: `Added discipline "${name}" with budget $${formatNumberShort(budget)}`,
                discipline: name,
                budget: budget,
                totalDisciplines: projectData.disciplines.length
            };
        }

        /**
         * Removes a discipline from the project
         */
        function executeRemoveDiscipline(args) {
            const { discipline } = args;
            
            const idx = projectData.disciplines.findIndex(
                d => d.toLowerCase() === discipline.toLowerCase()
            );
            
            if (idx === -1) {
                return { success: false, error: `Discipline "${discipline}" not found` };
            }
            
            const discName = projectData.disciplines[idx];
            const removedBudget = projectData.budgets[discName] || 0;
            
            // Remove discipline
            projectData.disciplines.splice(idx, 1);
            delete projectData.budgets[discName];
            
            // Remove claiming and dates entries
            Object.keys(projectData.claiming).forEach(key => {
                if (key.startsWith(`${discName}-`)) {
                    delete projectData.claiming[key];
                }
            });
            Object.keys(projectData.dates).forEach(key => {
                if (key.startsWith(`${discName}-`)) {
                    delete projectData.dates[key];
                }
            });
            
            triggerAutosave();
            
            return {
                success: true,
                message: `Removed discipline "${discName}" (freed $${formatNumberShort(removedBudget)})`,
                removedBudget: removedBudget,
                remainingDisciplines: projectData.disciplines.length
            };
        }

        /**
         * Modifies schedule dates
         */
        function executeModifySchedule(args) {
            const { discipline, package: pkg, action, days, date } = args;
            let modified = 0;
            const changes = [];
            
            // Build list of keys to modify
            const keysToModify = [];
            if (discipline.toLowerCase() === 'all') {
                projectData.disciplines.forEach(d => {
                    if (pkg && pkg.toLowerCase() !== 'all') {
                        keysToModify.push(`${d}-${pkg}`);
                    } else {
                        projectData.packages.forEach(p => keysToModify.push(`${d}-${p}`));
                    }
                });
            } else {
                const discName = projectData.disciplines.find(
                    d => d.toLowerCase() === discipline.toLowerCase()
                );
                if (!discName) {
                    return { success: false, error: `Discipline "${discipline}" not found` };
                }
                if (pkg && pkg.toLowerCase() !== 'all') {
                    keysToModify.push(`${discName}-${pkg}`);
                } else {
                    projectData.packages.forEach(p => keysToModify.push(`${discName}-${p}`));
                }
            }
            
            keysToModify.forEach(key => {
                if (!projectData.dates[key]) return;
                
                const dates = projectData.dates[key];
                const startDate = new Date(dates.start);
                const endDate = new Date(dates.end);
                
                switch (action) {
                    case 'extend':
                        endDate.setDate(endDate.getDate() + (days || 7));
                        break;
                    case 'shorten':
                        endDate.setDate(endDate.getDate() - (days || 7));
                        break;
                    case 'shift':
                        startDate.setDate(startDate.getDate() + (days || 0));
                        endDate.setDate(endDate.getDate() + (days || 0));
                        break;
                    case 'set_start':
                        if (date) {
                            const newStart = new Date(date);
                            const duration = (endDate - startDate) / (1000 * 60 * 60 * 24);
                            startDate.setTime(newStart.getTime());
                            endDate.setTime(newStart.getTime() + duration * 24 * 60 * 60 * 1000);
                        }
                        break;
                    case 'set_end':
                        if (date) {
                            endDate.setTime(new Date(date).getTime());
                        }
                        break;
                }
                
                projectData.dates[key] = {
                    start: startDate.toISOString().split('T')[0],
                    end: endDate.toISOString().split('T')[0]
                };
                
                modified++;
                changes.push({
                    key,
                    newStart: projectData.dates[key].start,
                    newEnd: projectData.dates[key].end
                });
            });
            
            triggerAutosave();
            
            return {
                success: true,
                message: `Modified ${modified} schedule entries`,
                action: action,
                daysChanged: days || 0,
                modifiedCount: modified,
                changes: changes.slice(0, 5) // Limit to first 5 for readability
            };
        }

        /**
         * Runs a what-if scenario analysis
         */
        function executeWhatIf(args) {
            const { scenario_description, changes = [] } = args;
            
            const currentTotal = Object.values(projectData.budgets).reduce((sum, b) => sum + b, 0);
            let projectedTotal = currentTotal;
            const impacts = [];
            
            changes.forEach(change => {
                const discKey = Object.keys(projectData.budgets).find(
                    d => d.toLowerCase() === change.discipline?.toLowerCase()
                );
                if (discKey) {
                    const current = projectData.budgets[discKey] || 0;
                    const changeAmt = change.is_percentage 
                        ? (current * change.budget_change / 100) 
                        : change.budget_change;
                    projectedTotal += changeAmt;
                    impacts.push({
                        discipline: discKey,
                        currentBudget: current,
                        projectedBudget: current + changeAmt,
                        change: changeAmt,
                        percentageChange: ((changeAmt / current) * 100).toFixed(1) + '%'
                    });
                }
            });
            
            return {
                success: true,
                scenario: scenario_description,
                currentTotalBudget: currentTotal,
                projectedTotalBudget: projectedTotal,
                netChange: projectedTotal - currentTotal,
                percentageChange: ((projectedTotal - currentTotal) / currentTotal * 100).toFixed(1) + '%',
                impacts: impacts,
                note: "This is a simulation. No changes have been applied."
            };
        }

        /**
         * Gets project summary and KPIs
         */
        function executeGetProjectSummary(args) {
            const { include_details = false } = args || {};
            
            const totalBudget = Object.values(projectData.budgets).reduce((sum, b) => sum + b, 0);
            const wbsCount = projectData.phases.length * projectData.disciplines.length * projectData.packages.length;
            
            // Find date range
            let minDate = null, maxDate = null;
            Object.values(projectData.dates).forEach(d => {
                if (d.start && (!minDate || d.start < minDate)) minDate = d.start;
                if (d.end && (!maxDate || d.end > maxDate)) maxDate = d.end;
            });
            
            const durationDays = minDate && maxDate 
                ? Math.ceil((new Date(maxDate) - new Date(minDate)) / (1000 * 60 * 60 * 24))
                : 0;
            
            const summary = {
                success: true,
                kpis: {
                    totalBudget: totalBudget,
                    formattedBudget: formatCurrency(totalBudget),
                    wbsElementCount: wbsCount,
                    phaseCount: projectData.phases.length,
                    disciplineCount: projectData.disciplines.length,
                    packageCount: projectData.packages.length,
                    projectStart: minDate,
                    projectEnd: maxDate,
                    durationDays: durationDays,
                    durationMonths: Math.ceil(durationDays / 30)
                },
                phases: projectData.phases,
                disciplines: projectData.disciplines,
                packages: projectData.packages
            };
            
            if (include_details) {
                summary.budgetBreakdown = {};
                projectData.disciplines.forEach(d => {
                    summary.budgetBreakdown[d] = {
                        amount: projectData.budgets[d] || 0,
                        percentage: totalBudget > 0 
                            ? ((projectData.budgets[d] || 0) / totalBudget * 100).toFixed(1) + '%'
                            : '0%'
                    };
                });
            }
            
            return summary;
        }

        /**
         * Helper to format numbers with K/M suffix
         */
        function formatNumberShort(num) {
            if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
            if (num >= 1000) return (num / 1000).toFixed(0) + 'K';
            return num.toFixed(0);
        }

        // ============================================
        // PREDICTIVE ANALYTICS / AI INSIGHTS
        // ============================================

        /**
         * Toggles the insights panel visibility
         */
        function toggleInsightsPanel() {
            const panel = document.querySelector('.insights-panel');
            const body = document.getElementById('insights-body');
            
            panel.classList.toggle('expanded');
            body.classList.toggle('hidden');
            
            // Calculate basic insights when opened for the first time
            if (!body.classList.contains('hidden')) {
                calculateBasicInsights();
            }
        }

        /**
         * Calculates basic insights without AI
         */
        function calculateBasicInsights() {
            const totalBudget = Object.values(projectData.budgets).reduce((sum, b) => sum + b, 0);
            const disciplineCount = projectData.disciplines.length;
            const packageCount = projectData.packages.length;
            
            // Risk Score Calculation
            let riskScore = 50; // Base medium
            const riskFactors = [];
            
            // Factor 1: Number of disciplines (more = more coordination risk)
            if (disciplineCount > 10) {
                riskScore += 15;
                riskFactors.push(`${disciplineCount} disciplines increases coordination complexity`);
            } else if (disciplineCount < 5) {
                riskScore -= 10;
                riskFactors.push('Manageable number of disciplines');
            }
            
            // Factor 2: Budget concentration
            const budgetValues = Object.values(projectData.budgets).filter(b => b > 0);
            if (budgetValues.length > 0) {
                const maxBudget = Math.max(...budgetValues);
                const concentration = maxBudget / totalBudget;
                if (concentration > 0.4) {
                    riskScore += 10;
                    riskFactors.push('High budget concentration in one discipline');
                }
            }
            
            // Factor 3: Schedule density
            let minDate = null, maxDate = null;
            Object.values(projectData.dates).forEach(d => {
                if (d.start && (!minDate || d.start < minDate)) minDate = d.start;
                if (d.end && (!maxDate || d.end > maxDate)) maxDate = d.end;
            });
            
            if (minDate && maxDate) {
                const durationDays = Math.ceil((new Date(maxDate) - new Date(minDate)) / (1000 * 60 * 60 * 24));
                const monthsPerMillion = durationDays / 30 / (totalBudget / 1000000);
                if (monthsPerMillion < 3) {
                    riskScore += 15;
                    riskFactors.push('Aggressive schedule relative to budget');
                }
            }
            
            // Clamp risk score
            riskScore = Math.max(0, Math.min(100, riskScore));
            
            // Determine risk level
            let riskLevel, riskClass;
            if (riskScore < 35) {
                riskLevel = 'LOW';
                riskClass = 'risk-low';
            } else if (riskScore < 65) {
                riskLevel = 'MEDIUM';
                riskClass = 'risk-medium';
            } else {
                riskLevel = 'HIGH';
                riskClass = 'risk-high';
            }
            
            // Update risk display
            const riskValue = document.getElementById('insight-risk-score');
            riskValue.textContent = riskLevel;
            riskValue.className = `insight-value ${riskClass}`;
            document.getElementById('insight-risk-details').textContent = 
                riskFactors.length > 0 ? riskFactors[0] : 'Project parameters within normal ranges';
            
            // Cost Forecast (simple projection with contingency)
            const contingencyRate = riskScore > 65 ? 0.15 : riskScore > 35 ? 0.10 : 0.05;
            const projectedCost = totalBudget * (1 + contingencyRate);
            document.getElementById('insight-cost-forecast').textContent = formatCurrency(projectedCost);
            document.getElementById('insight-cost-details').textContent = 
                `Includes ${(contingencyRate * 100).toFixed(0)}% risk contingency (${formatCurrency(totalBudget * contingencyRate)})`;
            
            // Schedule Forecast
            if (minDate && maxDate) {
                const today = new Date();
                const endDate = new Date(maxDate);
                const daysRemaining = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));
                
                if (daysRemaining < 0) {
                    document.getElementById('insight-schedule-forecast').textContent = 'Complete';
                    document.getElementById('insight-schedule-forecast').style.color = '#00ff00';
                    document.getElementById('insight-schedule-details').textContent = 'Project end date has passed';
                } else if (daysRemaining < 30) {
                    document.getElementById('insight-schedule-forecast').textContent = 'Final Phase';
                    document.getElementById('insight-schedule-forecast').style.color = '#ffd700';
                    document.getElementById('insight-schedule-details').textContent = `${daysRemaining} days until scheduled completion`;
                } else {
                    document.getElementById('insight-schedule-forecast').textContent = 'On Track';
                    document.getElementById('insight-schedule-forecast').style.color = '#00ff00';
                    document.getElementById('insight-schedule-details').textContent = 
                        `Completion: ${new Date(maxDate).toLocaleDateString()} (${Math.ceil(daysRemaining / 30)} months)`;
                }
            }
            
            // Budget Health Analysis
            const avgBudget = totalBudget / disciplineCount;
            const variance = budgetValues.reduce((sum, b) => sum + Math.pow(b - avgBudget, 2), 0) / budgetValues.length;
            const stdDev = Math.sqrt(variance);
            const coeffVar = stdDev / avgBudget;
            
            if (coeffVar < 0.5) {
                document.getElementById('insight-budget-health').textContent = 'Balanced';
                document.getElementById('insight-budget-health').style.color = '#00ff00';
                document.getElementById('insight-budget-details').textContent = 'Budget evenly distributed across disciplines';
            } else if (coeffVar < 1.0) {
                document.getElementById('insight-budget-health').textContent = 'Moderate';
                document.getElementById('insight-budget-health').style.color = '#ffd700';
                document.getElementById('insight-budget-details').textContent = 'Some disciplines have significantly higher budgets';
            } else {
                document.getElementById('insight-budget-health').textContent = 'Concentrated';
                document.getElementById('insight-budget-health').style.color = '#ff4444';
                document.getElementById('insight-budget-details').textContent = 'Budget heavily weighted toward few disciplines';
            }
        }

        /**
         * Generates AI-powered insights and optimization suggestions
         */
        async function generateAIInsights() {
            const apiKey = getValidApiKey();
            if (!apiKey) {
                alert('Please set your OpenAI API key first. Click the chat button and enter your key.');
                return;
            }
            
            const btn = document.getElementById('generate-insights-btn');
            const suggestionsList = document.getElementById('ai-suggestions-list');
            
            btn.disabled = true;
            btn.textContent = 'Analyzing...';
            suggestionsList.innerHTML = '<div class="suggestion-placeholder">🔄 Analyzing project data with AI...</div>';
            
            try {
                const totalBudget = Object.values(projectData.budgets).reduce((sum, b) => sum + b, 0);
                
                const prompt = `You are a project management expert analyzing an engineering design project. Provide 4-5 specific, actionable optimization suggestions.

PROJECT DATA:
- Total Budget: $${totalBudget.toLocaleString()}
- Phases: ${projectData.phases.join(', ')}
- Disciplines: ${projectData.disciplines.join(', ')}
- Packages: ${projectData.packages.join(', ')}

BUDGET BY DISCIPLINE:
${projectData.disciplines.map(d => `- ${d}: $${(projectData.budgets[d] || 0).toLocaleString()} (${((projectData.budgets[d] || 0) / totalBudget * 100).toFixed(1)}%)`).join('\n')}

${projectData.projectScope ? `PROJECT SCOPE: ${projectData.projectScope.substring(0, 500)}` : ''}

Provide suggestions as a JSON array:
[{"icon":"emoji","title":"short title","description":"specific actionable recommendation"}]

Focus on:
1. Budget optimization opportunities
2. Schedule efficiency improvements
3. Risk mitigation strategies
4. Resource allocation recommendations
5. Discipline coordination tips

Return ONLY the JSON array, no markdown.`;

                const response = await fetch('https://api.openai.com/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${apiKey}`
                    },
                    body: JSON.stringify({
                        model: 'gpt-5.2',
                        messages: [{ role: 'user', content: prompt }],
                        max_completion_tokens: 1500,
                        temperature: 0.7
                    })
                });
                
                if (!response.ok) {
                    throw new Error('API error');
                }
                
                const data = await response.json();
                const content = data.choices[0]?.message?.content || '';
                
                // Parse suggestions
                let suggestions = [];
                try {
                    const jsonMatch = content.match(/\[[\s\S]*\]/);
                    if (jsonMatch) {
                        suggestions = JSON.parse(jsonMatch[0]);
                    }
                } catch (e) {
                    console.error('Failed to parse AI suggestions:', e);
                }
                
                if (suggestions.length > 0) {
                    suggestionsList.innerHTML = suggestions.map(s => `
                        <div class="suggestion-item">
                            <span class="suggestion-icon">${s.icon || '💡'}</span>
                            <div class="suggestion-content">
                                <div class="suggestion-title">${escapeHtml(s.title || 'Suggestion')}</div>
                                <div class="suggestion-desc">${escapeHtml(s.description || '')}</div>
                            </div>
                        </div>
                    `).join('');
                } else {
                    suggestionsList.innerHTML = '<div class="suggestion-placeholder">No specific suggestions generated. Try again.</div>';
                }
                
            } catch (error) {
                console.error('AI Insights error:', error);
                suggestionsList.innerHTML = '<div class="suggestion-placeholder">Failed to generate insights. Check your API key and try again.</div>';
            } finally {
                btn.disabled = false;
                btn.textContent = 'Generate Insights';
            }
        }

        // ============================================
        // AI SCHEDULE GENERATION
        // ============================================

        /**
         * Generates an AI-powered schedule based on project scope and disciplines
         */
        async function generateAISchedule() {
            const apiKey = getValidApiKey();
            if (!apiKey) {
                alert('Please set your OpenAI API key first. Click the chat button and enter your key.');
                return;
            }
            
            // Get schedule parameters
            const startDateInput = document.getElementById('ai-schedule-start');
            const durationSelect = document.getElementById('ai-schedule-duration');
            
            // Default to today if no start date selected
            let startDate = startDateInput.value;
            if (!startDate) {
                const today = new Date();
                startDate = today.toISOString().split('T')[0];
                startDateInput.value = startDate;
            }
            
            const targetDuration = parseInt(durationSelect.value) || 12;
            
            // Show loading state
            const btn = document.getElementById('ai-schedule-btn');
            const loading = document.getElementById('ai-schedule-loading');
            btn.disabled = true;
            loading.classList.remove('hidden');
            
            try {
                // Build context for AI
                const totalBudget = Object.values(projectData.budgets).reduce((sum, b) => sum + b, 0);
                
                const contextPrompt = `You are a project scheduling expert for engineering design projects. Generate a realistic schedule for the following project:

**PROJECT DETAILS:**
- Phases: ${projectData.phases.join(', ')}
- Disciplines: ${projectData.disciplines.join(', ')}
- Packages/Milestones: ${projectData.packages.join(', ')}
- Total Budget: $${totalBudget.toLocaleString()}
- Project Start Date: ${startDate}
- Target Duration: ${targetDuration} months

**BUDGET DISTRIBUTION:**
${projectData.disciplines.map(d => `- ${d}: $${(projectData.budgets[d] || 0).toLocaleString()}`).join('\n')}

**CLAIMING PERCENTAGES:**
${projectData.disciplines.slice(0, 3).map(disc => {
    const claims = projectData.packages.map(pkg => {
        const key = `${disc}-${pkg}`;
        return `${pkg}: ${projectData.claiming[key] || 0}%`;
    }).join(', ');
    return `- ${disc}: ${claims}`;
}).join('\n')}
${projectData.disciplines.length > 3 ? `... and ${projectData.disciplines.length - 3} more disciplines with similar patterns` : ''}

${projectData.projectScope ? `**PROJECT SCOPE:**\n${projectData.projectScope.substring(0, 500)}` : ''}

**REQUIREMENTS:**
1. Schedule should fit within ${targetDuration} months starting from ${startDate}
2. Packages should overlap appropriately (engineering projects often have concurrent work)
3. Higher-budget disciplines may need more time
4. Earlier packages (Preliminary) should start first, later packages (RFC, Final) should end last
5. Consider typical engineering workflow dependencies

Return a JSON object with the schedule. Format:
{
  "schedule": {
    "discipline-package": {"start": "YYYY-MM-DD", "end": "YYYY-MM-DD", "notes": "brief note"}
  },
  "summary": "Brief explanation of the schedule approach"
}

Return ONLY the JSON, no markdown formatting.`;

                const response = await fetch('https://api.openai.com/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${apiKey}`
                    },
                    body: JSON.stringify({
                        model: 'gpt-5.2',
                        messages: [
                            { role: 'user', content: contextPrompt }
                        ],
                        max_completion_tokens: 4000,
                        temperature: 0.3
                    })
                });
                
                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(errorData.error?.message || `API error: ${response.status}`);
                }
                
                const data = await response.json();
                const content = data.choices[0]?.message?.content || '';
                
                // Parse the JSON response
                let scheduleData;
                try {
                    // Try to extract JSON from the response
                    const jsonMatch = content.match(/\{[\s\S]*\}/);
                    if (jsonMatch) {
                        scheduleData = JSON.parse(jsonMatch[0]);
                    } else {
                        throw new Error('No JSON found in response');
                    }
                } catch (e) {
                    console.error('Failed to parse AI schedule response:', e, content);
                    throw new Error('Failed to parse AI response. Please try again.');
                }
                
                // Apply the generated schedule
                if (scheduleData.schedule) {
                    Object.entries(scheduleData.schedule).forEach(([key, dates]) => {
                        if (projectData.dates[key]) {
                            projectData.dates[key] = {
                                start: dates.start,
                                end: dates.end
                            };
                        } else {
                            // Handle slight key mismatches by finding closest match
                            const [disc, pkg] = key.split('-');
                            const matchedDisc = projectData.disciplines.find(d => 
                                d.toLowerCase().includes(disc.toLowerCase()) || 
                                disc.toLowerCase().includes(d.toLowerCase())
                            );
                            const matchedPkg = projectData.packages.find(p => 
                                p.toLowerCase().includes(pkg.toLowerCase()) || 
                                pkg.toLowerCase().includes(p.toLowerCase())
                            );
                            if (matchedDisc && matchedPkg) {
                                const correctKey = `${matchedDisc}-${matchedPkg}`;
                                projectData.dates[correctKey] = {
                                    start: dates.start,
                                    end: dates.end
                                };
                            }
                        }
                    });
                    
                    // Rebuild the dates table to show updated values
                    buildDatesTable();
                    triggerAutosave();
                    
                    // Show summary
                    alert(`✅ AI Schedule Generated!\n\n${scheduleData.summary || 'Schedule has been applied to all disciplines and packages.'}\n\nReview and adjust dates as needed.`);
                }
                
            } catch (error) {
                console.error('AI Schedule generation error:', error);
                alert('Error generating schedule: ' + error.message);
            } finally {
                btn.disabled = false;
                loading.classList.add('hidden');
            }
        }

        /**
         * Sends a message to the OpenAI API with tool calling and streaming support
         */
        async function sendMessage() {
            const input = document.getElementById('chat-input');
            const message = input.value.trim();
            
            if (!message || chatState.isLoading) return;
            
            const apiKey = getValidApiKey();
            if (!apiKey) {
                showApiKeyModal();
                return;
            }
            
            // Add user message
            addMessage('user', message);
            input.value = '';
            input.style.height = 'auto';
            
            // Show loading state
            chatState.isLoading = true;
            document.getElementById('chat-send-btn').disabled = true;
            showTypingIndicator(true);
            
            try {
                // Check if we're on the results page (tools are available)
                const resultsVisible = !document.getElementById('results-section').classList.contains('hidden');
                const useTools = resultsVisible && projectData.disciplines.length > 0;
                
                // Build messages for API
                const apiMessages = [
                    { role: 'system', content: buildSystemPrompt() + (useTools ? '\n\nYou have access to tools to modify the project. Use them when the user asks to make changes.' : '') },
                    ...chatState.messages.filter(m => m.role !== 'system').slice(-10).map(m => ({
                        role: m.role,
                        content: m.content
                    }))
                ];
                
                // Make initial API call (non-streaming to detect tool calls)
                const response = await fetch('https://api.openai.com/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${apiKey}`
                    },
                    body: JSON.stringify({
                        model: 'gpt-5.2-chat-latest',
                        messages: apiMessages,
                        max_completion_tokens: 1000,
                        tools: useTools ? chatTools : undefined,
                        tool_choice: useTools ? 'auto' : undefined
                    })
                });
                
                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    if (response.status === 401) {
                        throw new Error('Invalid API key. Please check your OpenAI API key in settings.');
                    } else if (response.status === 429) {
                        throw new Error('Rate limit exceeded. Please wait a moment and try again.');
                    } else {
                        throw new Error(errorData.error?.message || `API error: ${response.status}`);
                    }
                }
                
                let data = await response.json();
                let assistantMessage = data.choices[0]?.message;
                
                // Handle tool calls if present
                if (assistantMessage?.tool_calls && assistantMessage.tool_calls.length > 0) {
                    showTypingIndicator(false);
                    
                    // Execute all tool calls
                    const toolResults = [];
                    const toolSummaries = [];
                    
                    for (const toolCall of assistantMessage.tool_calls) {
                        const funcName = toolCall.function.name;
                        let funcArgs = {};
                        
                        try {
                            funcArgs = JSON.parse(toolCall.function.arguments);
                        } catch (e) {
                            console.error('Failed to parse tool arguments:', e);
                        }
                        
                        console.log(`Executing tool: ${funcName}`, funcArgs);
                        const result = executeToolCall(funcName, funcArgs);
                        
                        toolResults.push({
                            tool_call_id: toolCall.id,
                            role: 'tool',
                            content: JSON.stringify(result)
                        });
                        
                        // Build summary for display
                        if (result.success) {
                            toolSummaries.push(`✅ ${result.message || funcName}`);
                        } else {
                            toolSummaries.push(`❌ ${result.error || 'Tool failed'}`);
                        }
                    }
                    
                    // Show tool execution summary
                    addMessage('system', `🔧 ${toolSummaries.join(' • ')}`);
                    
                    showTypingIndicator(true);
                    
                    // Send tool results back to get final response
                    const followUpMessages = [
                        ...apiMessages,
                        assistantMessage,
                        ...toolResults
                    ];
                    
                    const followUpResponse = await fetch('https://api.openai.com/v1/chat/completions', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${apiKey}`
                        },
                        body: JSON.stringify({
                            model: 'gpt-5.2-chat-latest',
                            messages: followUpMessages,
                            max_completion_tokens: 1000
                        })
                    });
                    
                    if (followUpResponse.ok) {
                        data = await followUpResponse.json();
                        assistantMessage = data.choices[0]?.message;
                    }
                }
                
                // Add assistant's final message
                const content = assistantMessage?.content || 'Done! The changes have been applied.';
                addMessage('assistant', content);
                
            } catch (error) {
                console.error('Chat error:', error);
                addMessage('system', `⚠️ ${error.message}`);
            } finally {
                chatState.isLoading = false;
                document.getElementById('chat-send-btn').disabled = false;
                showTypingIndicator(false);
            }
        }

        /**
         * Handles Enter key in chat input
         * @param {KeyboardEvent} event
         */
        function handleChatKeydown(event) {
            if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                sendMessage();
            }
        }

        /**
         * Auto-resizes the chat input textarea
         */
        function autoResizeChatInput() {
            const input = document.getElementById('chat-input');
            input.style.height = 'auto';
            input.style.height = Math.min(input.scrollHeight, 100) + 'px';
        }

        /**
         * Updates the context badge in chat header
         */
        function updateChatContextBadge() {
            const badge = document.getElementById('chat-context-badge');
            if (badge) {
                const resultsVisible = !document.getElementById('results-section').classList.contains('hidden');
                badge.textContent = resultsVisible ? 'RESULTS' : `STEP ${currentStep}`;
            }
        }

        // Update context badge when step changes
        const originalShowStep = showStep;
        showStep = function(step) {
            originalShowStep(step);
            updateChatContextBadge();
        };

        // Update context badge when WBS is generated
        const originalGenerateWBS = generateWBS;
        generateWBS = function() {
            originalGenerateWBS();
            updateChatContextBadge();
        };

        // ============================================
        // RFP WIZARD
        // ============================================

        const rfpState = {
            currentStage: 1,
            file: null,
            pageCount: 0,
            extractedText: '',
            extractedData: null,
            wasTruncated: false,
            originalLength: 0,
            analyzedLength: 0,
            chunkCount: 1,
            // Extracted quantities for MH estimation
            quantities: {
                roadwayLengthLF: 0,
                projectAreaAC: 0,
                wallAreaSF: 0,
                noiseWallAreaSF: 0,
                bridgeDeckAreaSF: 0,
                bridgeCount: 0,
                structureCount: 0,
                utilityRelocations: 0,
                permitCount: 0,
                trackLengthTF: 0
            },
            // AI reasoning for each quantity estimate
            quantityReasoning: {},
            projectInfo: {
                projectCostM: 0,
                designDurationMonths: 20,
                projectType: 'highway',
                complexity: 'Medium',
                // New fields for Chapter 1
                projectName: '',
                projectLocation: '',
                technicalProposalDue: '',
                priceProposalDue: '',
                interviewDate: '',
                contractAward: '',
                noticeToProceed: '',
                stipendAmount: '',
                ownerContractType: '',
                evaluationCriteria: '',
                dbeGoals: ''
            },
            // AI reasoning for project info (cost, schedule)
            projectInfoReasoning: {
                projectCostReasoning: '',
                scheduleReasoning: ''
            },
            // Chapter 2 - Commercial Terms (AI extracted)
            commercialTerms: {
                client: '',
                waiverConsequentialDamages: '',
                limitationOfLiability: '',
                professionalLiability: '',
                insuranceRequirements: '',
                standardOfCare: '',
                reliedUponInformation: '',
                thirdPartyDelays: '',
                thirdPartyContractorImpacts: '',
                indemnification: ''
            },
            // Confidence scores for commercial terms
            commercialTermsConfidence: {},
            usageStats: {
                totalPromptTokens: 0,
                totalCompletionTokens: 0,
                totalTokens: 0,
                apiCalls: 0,
                estimatedCost: 0,
                model: '',
                startTime: null,
                endTime: null
            }
        };

        // Initialize PDF.js worker
        if (typeof pdfjsLib !== 'undefined') {
            pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        }

        /**
         * Opens the RFP Wizard modal
         */
        function openRfpWizard() {
            document.getElementById('rfp-modal').classList.add('open');
            resetRfpWizard();
        }

        /**
         * Closes the RFP Wizard modal
         */
        function closeRfpWizard() {
            document.getElementById('rfp-modal').classList.remove('open');
        }

        /**
         * Resets the RFP Wizard to initial state
         */
        function resetRfpWizard() {
            rfpState.currentStage = 1;
            rfpState.file = null;
            rfpState.pageCount = 0;
            rfpState.extractedText = '';
            rfpState.extractedData = null;
            rfpState.wasTruncated = false;
            rfpState.originalLength = 0;
            rfpState.analyzedLength = 0;
            rfpState.chunkCount = 1;
            
            // Reset usage stats
            rfpState.usageStats = {
                totalPromptTokens: 0,
                totalCompletionTokens: 0,
                totalTokens: 0,
                apiCalls: 0,
                estimatedCost: 0,
                model: '',
                startTime: null,
                endTime: null
            };
            
            // Reset UI
            document.getElementById('rfp-file-info').classList.remove('visible');
            document.getElementById('rfp-file-input').value = '';
            document.getElementById('rfp-next-1').disabled = true;
            document.getElementById('rfp-page-range').value = '';
            document.getElementById('rfp-loading').classList.add('visible');
            document.getElementById('rfp-preview').style.display = 'none';
            document.getElementById('rfp-truncation-notice').style.display = 'none';
            document.getElementById('rfp-usage-stats').style.display = 'none';
            
            // Reset preview section
            const previewSection = document.getElementById('rfp-text-preview-section');
            if (previewSection) previewSection.style.display = 'none';
            const previewBtn = document.getElementById('rfp-preview-text-btn');
            if (previewBtn) previewBtn.style.display = 'none';
            
            goToRfpStage(1);
        }

        /**
         * Navigates to a specific stage in the RFP wizard
         */
        function goToRfpStage(stage) {
            rfpState.currentStage = stage;
            
            // Update stage indicators
            document.querySelectorAll('.rfp-stage').forEach((el, i) => {
                el.classList.remove('active', 'completed');
                if (i + 1 < stage) el.classList.add('completed');
                if (i + 1 === stage) el.classList.add('active');
            });
            
            // Show/hide stage content
            document.querySelectorAll('.rfp-stage-content').forEach((el, i) => {
                el.classList.toggle('active', i + 1 === stage);
            });
            
            // Show preview button on stage 2 if file is loaded
            const previewBtn = document.getElementById('rfp-preview-text-btn');
            if (previewBtn) {
                previewBtn.style.display = (stage === 2 && rfpState.file && !rfpState.extractedText) ? 'inline-block' : 'none';
            }
            
            // Hide preview section when leaving stage 2
            if (stage !== 2) {
                const previewSection = document.getElementById('rfp-text-preview-section');
                if (previewSection) previewSection.style.display = 'none';
            }
        }

        /**
         * Handles file selection from input
         */
        function handleRfpFileSelect(event) {
            const file = event.target.files[0];
            if (file) {
                handleRfpUpload(file);
            }
        }

        /**
         * Handles PDF file upload (from input or drag-drop)
         */
        async function handleRfpUpload(file) {
            if (file.type !== 'application/pdf') {
                alert('Please upload a PDF file.');
                return;
            }
            
            rfpState.file = file;
            
            // Display file info
            document.getElementById('rfp-file-name').textContent = file.name;
            document.getElementById('rfp-file-meta').textContent = formatFileSize(file.size);
            document.getElementById('rfp-file-info').classList.add('visible');
            
            // Get page count
            try {
                const arrayBuffer = await file.arrayBuffer();
                const pdf = await pdfjsLib.getDocument({ 
                    data: arrayBuffer,
                    standardFontDataUrl: window.PDFJS_STANDARD_FONT_DATA_URL
                }).promise;
                rfpState.pageCount = pdf.numPages;
                document.getElementById('rfp-page-count').textContent = pdf.numPages;
                document.getElementById('rfp-next-1').disabled = false;
                
                // Show preview button if on stage 2
                if (rfpState.currentStage === 2) {
                    const previewBtn = document.getElementById('rfp-preview-text-btn');
                    if (previewBtn && !rfpState.extractedText) {
                        previewBtn.style.display = 'inline-block';
                    }
                }
            } catch (error) {
                console.error('Error reading PDF:', error);
                alert('Error reading PDF file. Please try another file.');
                removeRfpFile();
            }
        }

        /**
         * Removes the uploaded file
         */
        function removeRfpFile() {
            rfpState.file = null;
            rfpState.pageCount = 0;
            document.getElementById('rfp-file-info').classList.remove('visible');
            document.getElementById('rfp-file-input').value = '';
            document.getElementById('rfp-next-1').disabled = true;
        }

        /**
         * Formats file size for display
         */
        function formatFileSize(bytes) {
            if (bytes < 1024) return bytes + ' B';
            if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
            return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
        }

        /**
         * Formats large numbers with commas
         */
        function formatNumber(num) {
            return num.toLocaleString('en-US');
        }

        /**
         * Parses page range string into array of page numbers
         * e.g., "1-5,8,10-12" → [1,2,3,4,5,8,10,11,12]
         */
        function parsePageRange(rangeStr, maxPages) {
            if (!rangeStr || !rangeStr.trim()) {
                // Return all pages if empty
                return Array.from({ length: maxPages }, (_, i) => i + 1);
            }
            
            const pages = new Set();
            const parts = rangeStr.split(',').map(s => s.trim());
            
            for (const part of parts) {
                if (part.includes('-')) {
                    const [start, end] = part.split('-').map(n => parseInt(n.trim()));
                    if (!isNaN(start) && !isNaN(end)) {
                        for (let i = Math.max(1, start); i <= Math.min(maxPages, end); i++) {
                            pages.add(i);
                        }
                    }
                } else {
                    const num = parseInt(part);
                    if (!isNaN(num) && num >= 1 && num <= maxPages) {
                        pages.add(num);
                    }
                }
            }
            
            return Array.from(pages).sort((a, b) => a - b);
        }

        /**
         * Extracts text from PDF using PDF.js
         */
        async function extractPdfText(file, pageNumbers) {
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument({ 
                data: arrayBuffer,
                standardFontDataUrl: window.PDFJS_STANDARD_FONT_DATA_URL
            }).promise;
            
            let fullText = '';
            
            for (const pageNum of pageNumbers) {
                if (pageNum > pdf.numPages) continue;
                
                const page = await pdf.getPage(pageNum);
                const textContent = await page.getTextContent();
                const pageText = textContent.items.map(item => item.str).join(' ');
                fullText += `\n--- Page ${pageNum} ---\n${pageText}\n`;
            }
            
            return fullText;
        }

        // Drag and drop handlers
        document.addEventListener('DOMContentLoaded', () => {
            const dropzone = document.getElementById('rfp-dropzone');
            if (dropzone) {
                dropzone.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    dropzone.classList.add('dragover');
                });
                
                dropzone.addEventListener('dragleave', () => {
                    dropzone.classList.remove('dragover');
                });
                
                dropzone.addEventListener('drop', (e) => {
                    e.preventDefault();
                    dropzone.classList.remove('dragover');
                    const file = e.dataTransfer.files[0];
                    if (file) handleRfpUpload(file);
                });
            }
        });

        /**
         * Splits text into chunks of approximately MAX_CHUNK_SIZE with overlap
         */
        function splitTextIntoChunks(text, maxChunkSize) {
            const chunks = [];
            const overlapSize = 2000; // 2K char overlap - optimized to reduce redundancy while maintaining context
            
            if (text.length <= maxChunkSize) {
                return [text];
            }
            
            let start = 0;
            while (start < text.length) {
                let end = start + maxChunkSize;
                
                // If not the last chunk, try to break at a sentence boundary
                if (end < text.length) {
                    // Look for sentence endings within last 1000 chars
                    const searchStart = Math.max(start + maxChunkSize - 1000, start);
                    const searchText = text.substring(searchStart, end);
                    const lastPeriod = searchText.lastIndexOf('. ');
                    const lastNewline = searchText.lastIndexOf('\n\n');
                    const breakPoint = Math.max(lastPeriod, lastNewline);
                    
                    if (breakPoint > 0) {
                        end = searchStart + breakPoint + (lastPeriod > lastNewline ? 2 : 2);
                    }
                }
                
                chunks.push(text.substring(start, end));
                
                // Next chunk starts with overlap
                start = end - overlapSize;
                if (start < 0) start = 0;
            }
            
            return chunks;
        }

        /**
         * Analyzes a single text chunk with OpenAI
         */
        async function analyzeChunk(apiKey, chunkText, chunkIndex, totalChunks) {
            const systemPrompt = `You are an expert transportation infrastructure cost estimator and contract analyst. Extract WBS info, quantities, project details, and commercial terms from this RFP chunk ${chunkIndex + 1}/${totalChunks}. Return raw JSON only:
{"phases":[],"disciplines":[],"disciplineScopes":{},"packages":[],"budgets":{},"scope":"","schedule":"","reviewSteps":[],"risks":[],"quantities":{},"quantityReasoning":{},"projectInfo":{},"projectInfoReasoning":{},"commercialTerms":{},"commercialTermsConfidence":{},"scheduleReasoning":"","confidence":{},"notes":"","wallProject":false,"wallMetricType":"alignment"}

**PHASES**: Project stages (e.g. Base Design, ESDC, TSCD, Preliminary, Final, As-Builts, Closeout, Phase 1/2/3)
**DISCIPLINES**: Use EXACT names: Roadway, Drainage, MOT, Traffic, Utilities, Retaining Walls, Noise Walls, Bridge Structures, Misc Structures, Geotechnical, Systems, Track, Environmental, Digital Delivery, ESDC, TSCD
**DISCIPLINE SCOPES**: {"Discipline":"scope description"} - Extract specific tasks/deliverables per discipline
**PACKAGES**: Milestones (e.g. Preliminary, Interim, Final, RFC, As-Built, 30%, 60%, 90%)
**SCOPE**: Project location, type, major work elements, requirements
**SCHEDULE**: Timeline info, durations, milestones, deadlines (general description)
**REVIEW STEPS**: Array of design review milestones mentioned in RFP: ["Design Development", "Internal Design Review", "Owner's Review", "Comment Resolution", "Final Approval", "Constructability Review", "Value Engineering", "Safety Review", "QA/QC Review", "Permit Review", "Stakeholder Review", etc.] - Extract ALL review/approval steps mentioned
**RISKS**: Array: [{"category":"Schedule|Budget|Technical|Scope|Coordination|Legal|Commercial","severity":"High|Medium|Low","description":"specific risk","mitigation":"suggested mitigation"}]

**WALL PROJECT DETECTION**:
- wallProject: true if this is a border wall/barrier wall project, false otherwise
- wallMetricType: "alignment" if quantities are based on alignment/fence line length, "barrier" if based on barrier panel/section length (detect from RFP context)

**QUANTITIES** (estimate if not explicit):
- roadwayLengthLF: Alignment/centerline length for roadway disciplines (LF)
- alignmentLengthLF: Total fence line/alignment length for wall projects (LF)
- barrierLengthLF: Total barrier panel/section length for wall projects (LF)
- projectAreaAC: Project area in acres
- wallAreaSF: Retaining wall surface area (SF)
- noiseWallAreaSF: Noise wall surface area (SF)
- bridgeDeckAreaSF: Bridge deck area (SF)
- bridgeCount, structureCount, utilityRelocations, permitCount, trackLengthTF
**QUANTITY REASONING**: {"key": "explanation"} for each quantity

**PROJECT INFO - REQUIRED**:
- projectName: Official project name/title
- projectLocation: City, county, state, or corridor description
- projectCostM: Construction cost in $millions (estimate using: Resurfacing $1-5M/mile, Highway widening $20-50M/mile, Bridge $500-2000/SF)
- designDurationMonths: 12-48 months based on complexity
- projectType: "highway"|"transit"|"bridge"|"utility"
- complexity: "Low"|"Medium"|"High"
- technicalProposalDue: Date string if found (e.g., "March 15, 2026")
- priceProposalDue: Date string if found
- interviewDate: Date string if found
- contractAward: Expected award date if found
- noticeToProceed: NTP date if found
- stipendAmount: Stipend amount in dollars if mentioned (e.g., "$50,000")
- ownerContractType: "Design-Build"|"Design-Bid-Build"|"CMAR"|"Progressive Design-Build"|"Best Value"|"Low Bid"|"Qualifications Based"
- evaluationCriteria: Scoring criteria summary (e.g., "Technical 60%, Price 40%" or list of evaluation factors)
- dbeGoals: DBE/SBE/MBE goals (e.g., "15% DBE goal")

**PROJECT INFO REASONING**: {"projectCostReasoning": "...", "scheduleReasoning": "..."}

**COMMERCIAL TERMS - EXTRACT FROM CONTRACT/LEGAL SECTIONS**:
- client: Owner/agency name
- waiverConsequentialDamages: "Yes"|"No"|"Partial"|"Not specified" + brief explanation
- limitationOfLiability: Cap amount or "Unlimited" or "Not specified" + explanation
- professionalLiability: Required coverage amount (e.g., "$2M per occurrence") or "Not specified"
- insuranceRequirements: Summary of key insurance requirements
- standardOfCare: Any modifications to standard professional standard of care
- reliedUponInformation: What information owner is providing that consultant can rely upon
- thirdPartyDelays: How delays by third parties are handled
- thirdPartyContractorImpacts: Coordination requirements with other contractors
- indemnification: "Mutual"|"One-way to owner"|"Broad form"|"Limited" + key terms

**COMMERCIAL TERMS CONFIDENCE**: {"fieldName": "high|medium|low"} for each commercial term extracted

IMPORTANT: 
- NEVER return 0 for quantities if that discipline applies
- Extract ALL dates mentioned (proposal due, interview, award, NTP)
- Look for contract terms in legal/terms sections
- Confidence: "high"=explicit in RFP, "medium"=inferred, "low"=estimated`;

            // Retry logic with exponential backoff for network errors (HTTP/2 protocol errors)
            let response = null;
            let retries = 5;
            let lastError = null;
            const baseDelay = 1000; // Start with 1 second
            
            while (retries > 0 && !response) {
                try {
                    response = await fetch('https://api.openai.com/v1/chat/completions', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${apiKey}`
                        },
                        body: JSON.stringify({
                            model: 'gpt-5.2-thinking',
                            messages: [
                                { role: 'system', content: systemPrompt },
                                { role: 'user', content: `Analyze this RFP document (chunk ${chunkIndex + 1} of ${totalChunks}). Extract WBS information AND estimate all quantities and project costs based on the scope described. Even if quantities aren't explicitly stated, use your engineering expertise to provide reasonable estimates for man-hour estimation purposes:\n\n${chunkText}` }
                            ],
                            max_completion_tokens: 64000,
                            temperature: 0.3
                        })
                    });
                    
                    if (!response.ok) {
                        const errorData = await response.json().catch(() => ({}));
                        throw new Error(errorData.error?.message || `API error: ${response.status}`);
                    }
                } catch (err) {
                    lastError = err;
                    retries--;
                    
                    // Check if it's a network error (likely HTTP/2 protocol error)
                    const isNetworkError = err.message.includes('Failed to fetch') || 
                                          err.message.includes('NetworkError') ||
                                          err.message.includes('ERR_');
                    
                    if (retries > 0 && isNetworkError) {
                        // Exponential backoff: 1s, 2s, 4s, 8s, 16s
                        const delay = baseDelay * Math.pow(2, 5 - retries - 1);
                        console.log(`Chunk ${chunkIndex + 1} network error, retrying in ${delay/1000}s... (${retries} attempts left)`);
                        document.querySelector('.rfp-loading-text').textContent = `Network error, retrying in ${delay/1000}s... (${retries} attempts left)`;
                        await new Promise(r => setTimeout(r, delay));
                        response = null; // Reset to retry
                    } else if (retries === 0) {
                        throw new Error(`Network error after 5 retries: ${lastError.message}. Please check your internet connection and try again.`);
                    } else {
                        throw err; // Non-network error, don't retry
                    }
                }
            }
            
            const data = await response.json();
            
            // Log full API response structure for debugging
            console.log(`Chunk ${chunkIndex + 1} full API response:`, JSON.stringify(data, null, 2).substring(0, 1000));
            
            // Extract usage data from response
            const usage = data.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
            
            const content = data.choices?.[0]?.message?.content || data.output?.message?.content || '';
            
            // Log raw response for debugging
            console.log(`Chunk ${chunkIndex + 1} extracted content:`, content ? content.substring(0, 500) : 'EMPTY CONTENT');
            console.log(`Chunk ${chunkIndex + 1} usage:`, usage);
            
            // Parse JSON response - handle various formats
            let parsedData;
            try {
                // Try to extract JSON from markdown code blocks first
                const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
                if (codeBlockMatch) {
                    const jsonContent = codeBlockMatch[1].trim();
                    const jsonMatch = jsonContent.match(/\{[\s\S]*\}/);
                    if (jsonMatch) {
                        parsedData = JSON.parse(jsonMatch[0]);
                    }
                }
                
                if (!parsedData) {
                    // Try to find JSON object directly
                    const jsonMatch = content.match(/\{[\s\S]*\}/);
                    if (jsonMatch) {
                        parsedData = JSON.parse(jsonMatch[0]);
                    } else {
                        // Last resort: try parsing the whole content
                        parsedData = JSON.parse(content);
                    }
                }
            } catch (e) {
                console.error(`JSON parse error for chunk ${chunkIndex + 1}:`, e.message);
                console.error('Content was:', content);
                throw new Error(`Could not parse AI response as JSON for chunk ${chunkIndex + 1}`);
            }
            
            // Return both parsed data and usage stats
            return {
                data: parsedData,
                usage: usage,
                model: data.model || 'gpt-5.2-thinking'
            };
        }

        /**
         * Locally merges simple array fields (phases, disciplines, packages) to reduce API cost
         * @param {Array} chunkResults - Array of {data, usage, model} objects from analyzeChunk
         */
        function localMergeSimpleFields(chunkResults) {
            const merged = {
                phases: [],
                disciplines: [],
                packages: [],
                budgets: {},
                risks: [],
                wallProject: false,
                wallMetricType: 'alignment',
                quantities: {
                    roadwayLengthLF: 0,
                    alignmentLengthLF: 0,
                    barrierLengthLF: 0,
                    projectAreaAC: 0,
                    wallAreaSF: 0,
                    noiseWallAreaSF: 0,
                    bridgeDeckAreaSF: 0,
                    bridgeCount: 0,
                    structureCount: 0,
                    utilityRelocations: 0,
                    permitCount: 0,
                    trackLengthTF: 0
                },
                // AI reasoning for quantity estimates
                quantityReasoning: {},
                projectInfo: {
                    projectCostM: 0,
                    designDurationMonths: 20,
                    projectType: 'highway',
                    complexity: 'Medium'
                },
                // AI reasoning for project info
                projectInfoReasoning: {
                    projectCostReasoning: '',
                    scheduleReasoning: ''
                }
            };

            // Merge phases - deduplicate and preserve order
            const phasesSet = new Set();
            chunkResults.forEach(resultObj => {
                const result = resultObj.data || resultObj; // Handle both new {data, usage} and legacy formats
                if (result.phases && Array.isArray(result.phases)) {
                    result.phases.forEach(phase => {
                        if (phase && !phasesSet.has(phase)) {
                            phasesSet.add(phase);
                            merged.phases.push(phase);
                        }
                    });
                }
            });

            // Merge disciplines - deduplicate and preserve order
            const disciplinesSet = new Set();
            chunkResults.forEach(resultObj => {
                const result = resultObj.data || resultObj;
                if (result.disciplines && Array.isArray(result.disciplines)) {
                    result.disciplines.forEach(disc => {
                        if (disc && !disciplinesSet.has(disc)) {
                            disciplinesSet.add(disc);
                            merged.disciplines.push(disc);
                        }
                    });
                }
            });

            // Merge packages - deduplicate and preserve order
            const packagesSet = new Set();
            chunkResults.forEach(resultObj => {
                const result = resultObj.data || resultObj;
                if (result.packages && Array.isArray(result.packages)) {
                    result.packages.forEach(pkg => {
                        if (pkg && !packagesSet.has(pkg)) {
                            packagesSet.add(pkg);
                            merged.packages.push(pkg);
                        }
                    });
                }
            });

            // Merge risks - collect all risks, deduplicate by description similarity
            const riskDescriptions = new Set();
            chunkResults.forEach(resultObj => {
                const result = resultObj.data || resultObj;
                if (result.risks && Array.isArray(result.risks)) {
                    result.risks.forEach(risk => {
                        const descKey = (risk.description || '').toLowerCase().substring(0, 50);
                        if (descKey && !riskDescriptions.has(descKey)) {
                            riskDescriptions.add(descKey);
                            merged.risks.push(risk);
                        }
                    });
                }
            });

            // Merge reviewSteps - collect all unique review steps from RFP
            if (!merged.reviewSteps) merged.reviewSteps = [];
            const reviewStepsSet = new Set();
            chunkResults.forEach(resultObj => {
                const result = resultObj.data || resultObj;
                if (result.reviewSteps && Array.isArray(result.reviewSteps)) {
                    result.reviewSteps.forEach(step => {
                        const stepName = typeof step === 'string' ? step : step.name || step;
                        const normalizedName = stepName.toLowerCase().trim();
                        if (stepName && !reviewStepsSet.has(normalizedName)) {
                            reviewStepsSet.add(normalizedName);
                            merged.reviewSteps.push(stepName);
                        }
                    });
                }
            });

            // Merge quantities - take maximum values found across chunks
            // Also track which chunk provided the best quantity for reasoning
            const quantitySourceChunk = {};
            chunkResults.forEach((resultObj, chunkIdx) => {
                const result = resultObj.data || resultObj;
                if (result.quantities) {
                    for (const key of Object.keys(merged.quantities)) {
                        const val = parseFloat(result.quantities[key]) || 0;
                        if (val > merged.quantities[key]) {
                            merged.quantities[key] = val;
                            quantitySourceChunk[key] = chunkIdx;
                        }
                    }
                }
            });
            
            // Merge quantityReasoning - take reasoning from the chunk that provided the best quantity
            chunkResults.forEach((resultObj, chunkIdx) => {
                const result = resultObj.data || resultObj;
                if (result.quantityReasoning) {
                    for (const key of Object.keys(result.quantityReasoning)) {
                        // Take reasoning if this chunk provided the value or if no reasoning exists yet
                        if (quantitySourceChunk[key] === chunkIdx || !merged.quantityReasoning[key]) {
                            if (result.quantityReasoning[key]) {
                                merged.quantityReasoning[key] = result.quantityReasoning[key];
                            }
                        }
                    }
                }
            });

            // Merge projectInfo - take first non-zero/non-default values
            let projectInfoSourceChunk = -1;
            chunkResults.forEach((resultObj, chunkIdx) => {
                const result = resultObj.data || resultObj;
                if (result.projectInfo) {
                    if (result.projectInfo.projectCostM && result.projectInfo.projectCostM > merged.projectInfo.projectCostM) {
                        merged.projectInfo.projectCostM = result.projectInfo.projectCostM;
                        projectInfoSourceChunk = chunkIdx;
                    }
                    if (result.projectInfo.designDurationMonths && result.projectInfo.designDurationMonths !== 20) {
                        merged.projectInfo.designDurationMonths = result.projectInfo.designDurationMonths;
                    }
                    if (result.projectInfo.projectType && result.projectInfo.projectType !== 'highway') {
                        merged.projectInfo.projectType = result.projectInfo.projectType;
                    }
                    if (result.projectInfo.complexity && result.projectInfo.complexity !== 'Medium') {
                        merged.projectInfo.complexity = result.projectInfo.complexity;
                    }
                    // Merge new project info fields - take first non-empty value
                    const newFields = ['projectName', 'projectLocation', 'technicalProposalDue', 'priceProposalDue', 
                                      'interviewDate', 'contractAward', 'noticeToProceed', 'stipendAmount', 
                                      'ownerContractType', 'evaluationCriteria', 'dbeGoals'];
                    newFields.forEach(field => {
                        if (result.projectInfo[field] && !merged.projectInfo[field]) {
                            merged.projectInfo[field] = result.projectInfo[field];
                        }
                    });
                }
            });
            
            // Merge projectInfoReasoning - take from best source chunk or first available
            chunkResults.forEach((resultObj, chunkIdx) => {
                const result = resultObj.data || resultObj;
                if (result.projectInfoReasoning) {
                    if (result.projectInfoReasoning.projectCostReasoning &&
                        (projectInfoSourceChunk === chunkIdx || !merged.projectInfoReasoning.projectCostReasoning)) {
                        merged.projectInfoReasoning.projectCostReasoning = result.projectInfoReasoning.projectCostReasoning;
                    }
                    if (result.projectInfoReasoning.scheduleReasoning && !merged.projectInfoReasoning.scheduleReasoning) {
                        merged.projectInfoReasoning.scheduleReasoning = result.projectInfoReasoning.scheduleReasoning;
                    }
                }
                // Also check for scheduleReasoning at root level (older format)
                if (result.scheduleReasoning && !merged.projectInfoReasoning.scheduleReasoning) {
                    merged.projectInfoReasoning.scheduleReasoning = result.scheduleReasoning;
                }
            });

            // Merge Wall project fields - if ANY chunk identifies it as a wall project, set to true
            chunkResults.forEach((resultObj) => {
                const result = resultObj.data || resultObj;
                if (result.wallProject === true) {
                    merged.wallProject = true;
                }
                // Take first non-default wallMetricType
                if (result.wallMetricType && result.wallMetricType !== 'alignment' && merged.wallMetricType === 'alignment') {
                    merged.wallMetricType = result.wallMetricType;
                }
            });

            return merged;
        }

        /**
         * Merges multiple chunk results into a final consolidated result (OPTIMIZED)
         * Uses local merge for simple arrays and AI only for complex fields
         */
        async function mergeChunkResults(apiKey, chunkResults) {
            // Step 1: Local merge of simple fields (no API cost)
            const localMerged = localMergeSimpleFields(chunkResults);
            console.log('Local merge complete:', localMerged);

            // Step 2: Use AI to merge complex fields (disciplineScopes, scope, schedule, confidence, notes, commercialTerms)
            // Extract ONLY the complex fields to reduce payload size significantly
            const complexFieldsOnly = chunkResults.map((r, idx) => {
                const data = r.data || r;
                return {
                    chunk: idx + 1,
                    disciplineScopes: data.disciplineScopes || {},
                    scope: data.scope || '',
                    schedule: data.schedule || '',
                    confidence: data.confidence || {},
                    notes: data.notes || '',
                    commercialTerms: data.commercialTerms || {},
                    commercialTermsConfidence: data.commercialTermsConfidence || {},
                    projectInfo: {
                        projectName: data.projectInfo?.projectName || '',
                        projectLocation: data.projectInfo?.projectLocation || '',
                        evaluationCriteria: data.projectInfo?.evaluationCriteria || '',
                        dbeGoals: data.projectInfo?.dbeGoals || ''
                    }
                };
            });
            
            const mergePrompt = `Merge ${chunkResults.length} WBS chunk analyses (complex fields only). Return raw JSON:
{"disciplineScopes":{},"scope":"","schedule":"","commercialTerms":{},"commercialTermsConfidence":{},"projectInfo":{"projectName":"","projectLocation":"","evaluationCriteria":"","dbeGoals":""},"confidence":{},"notes":""}

Merge rules:
- disciplineScopes: Combine scope descriptions per discipline from all chunks
- scope: Comprehensive project summary combining all chunks
- schedule: Combined timeline info from all chunks
- commercialTerms: Merge all commercial/legal terms found across chunks. For each field, use the most specific/complete value found.
- commercialTermsConfidence: Use highest confidence level found for each commercial term
- projectInfo: Use first non-empty value found for projectName, projectLocation. Combine evaluationCriteria and dbeGoals if found in multiple chunks.
- confidence: Use highest confidence level found across chunks (high > medium > low)
- notes: Combine all notes

Chunks: ${JSON.stringify(complexFieldsOnly, null, 2)}`;

            // Retry logic for network errors (HTTP/2 protocol errors) with exponential backoff
            let response = null;
            let retries = 5;
            let lastError = null;
            const baseDelay = 1000;
            
            while (retries > 0 && !response) {
                try {
                    response = await fetch('https://api.openai.com/v1/chat/completions', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${apiKey}`
                        },
                        body: JSON.stringify({
                            model: 'gpt-5.2-thinking',
                            messages: [
                                { role: 'user', content: mergePrompt }
                            ],
                            max_completion_tokens: 64000,
                            temperature: 0.2
                        })
                    });
                    
                    if (!response.ok) {
                        const errorData = await response.json().catch(() => ({}));
                        throw new Error(errorData.error?.message || `API error: ${response.status}`);
                    }
                } catch (err) {
                    lastError = err;
                    retries--;
                    
                    // Check if it's a network error
                    const isNetworkError = err.message.includes('Failed to fetch') || 
                                          err.message.includes('NetworkError') ||
                                          err.message.includes('ERR_');
                    
                    if (retries > 0 && isNetworkError) {
                        // Exponential backoff
                        const delay = baseDelay * Math.pow(2, 5 - retries - 1);
                        console.log(`Merge API call failed, retrying in ${delay/1000}s... (${retries} attempts left):`, err.message);
                        await new Promise(r => setTimeout(r, delay));
                        response = null;
                    } else if (retries > 0) {
                        // Non-network error, still retry but with shorter delay
                        console.log(`Merge API call failed, retrying... (${retries} attempts left):`, err.message);
                        await new Promise(r => setTimeout(r, 2000));
                        response = null;
                    }
                }
            }
            
            if (!response) {
                throw new Error(`Failed to merge results after 5 retries: ${lastError?.message || 'Unknown error'}. Please check your internet connection and try again.`);
            }

            const data = await response.json();
            const content = data.choices[0]?.message?.content || '';
            
            // Extract usage data from merge API call
            const usage = data.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
            console.log('AI merge usage:', usage);

            console.log('AI merge raw response:', content.substring(0, 500));

            let aiMerged;
            try {
                // Try to extract JSON from markdown code blocks first
                const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
                if (codeBlockMatch) {
                    const jsonContent = codeBlockMatch[1].trim();
                    const jsonMatch = jsonContent.match(/\{[\s\S]*\}/);
                    if (jsonMatch) {
                        aiMerged = JSON.parse(jsonMatch[0]);
                    }
                } else {
                    // Try to find JSON object directly
                    const jsonMatch = content.match(/\{[\s\S]*\}/);
                    if (jsonMatch) {
                        aiMerged = JSON.parse(jsonMatch[0]);
                    } else {
                        aiMerged = JSON.parse(content);
                    }
                }
            } catch (e) {
                console.error('Merge JSON parse error:', e.message);
                console.error('Content was:', content);
                throw new Error('Could not parse merged result as JSON');
            }

            // Step 3: Combine local merge (simple arrays) with AI merge (complex fields)
            // Merge projectInfo from both local and AI merge
            const mergedProjectInfo = {
                ...localMerged.projectInfo,
                projectName: aiMerged.projectInfo?.projectName || localMerged.projectInfo?.projectName || '',
                projectLocation: aiMerged.projectInfo?.projectLocation || localMerged.projectInfo?.projectLocation || '',
                evaluationCriteria: aiMerged.projectInfo?.evaluationCriteria || localMerged.projectInfo?.evaluationCriteria || '',
                dbeGoals: aiMerged.projectInfo?.dbeGoals || localMerged.projectInfo?.dbeGoals || ''
            };
            
            return {
                data: {
                    phases: localMerged.phases,
                    disciplines: localMerged.disciplines,
                    packages: localMerged.packages,
                    budgets: localMerged.budgets,
                    risks: localMerged.risks || [],
                    quantities: localMerged.quantities || {},
                    projectInfo: mergedProjectInfo,
                    disciplineScopes: aiMerged.disciplineScopes || {},
                    scope: aiMerged.scope || '',
                    schedule: aiMerged.schedule || '',
                    confidence: aiMerged.confidence || {},
                    notes: aiMerged.notes || '',
                    commercialTerms: aiMerged.commercialTerms || {},
                    commercialTermsConfidence: aiMerged.commercialTermsConfidence || {}
                },
                usage: usage,
                model: data.model || 'gpt-5.2-thinking'
            };
        }

        /**
         * Previews the extracted text before sending to AI
         */
        async function previewExtractedText() {
            if (!rfpState.file) return;
            
            const pageRange = document.getElementById('rfp-page-range').value;
            const pages = parsePageRange(pageRange, rfpState.pageCount);
            
            // Show loading state
            const previewBtn = document.getElementById('rfp-preview-text-btn');
            previewBtn.disabled = true;
            previewBtn.textContent = 'Extracting...';
            
            try {
                const text = await extractPdfText(rfpState.file, pages);
                rfpState.extractedText = text;
                
                // Update stats
                document.getElementById('rfp-preview-page-count').textContent = pages.length;
                document.getElementById('rfp-preview-char-count').textContent = formatNumber(text.length);
                document.getElementById('rfp-preview-token-est').textContent = '~' + formatNumber(Math.ceil(text.length / 4)); // Rough estimate: 1 token ≈ 4 chars
                
                // Show preview snippet (first 1000 chars)
                const snippet = text.length > 1000 ? text.substring(0, 1000) + '\n\n[... text continues ...]' : text;
                document.getElementById('rfp-text-preview-snippet').textContent = snippet;
                document.getElementById('rfp-text-preview-full').textContent = text;
                
                // Show preview section
                document.getElementById('rfp-text-preview-section').style.display = 'block';
                document.getElementById('rfp-text-preview-content').style.display = 'block';
                document.getElementById('rfp-preview-toggle-text').textContent = 'Hide';
                
                previewBtn.style.display = 'none';
                
            } catch (error) {
                console.error('Text extraction error:', error);
                alert('Error extracting text: ' + error.message);
            } finally {
                previewBtn.disabled = false;
                previewBtn.textContent = 'Preview Text';
            }
        }

        /**
         * Toggles the text preview visibility
         */
        function toggleTextPreview() {
            const content = document.getElementById('rfp-text-preview-content');
            const toggle = document.getElementById('rfp-preview-toggle-text');
            
            if (content.style.display === 'none') {
                content.style.display = 'block';
                toggle.textContent = 'Hide';
            } else {
                content.style.display = 'none';
                toggle.textContent = 'Show';
            }
        }

        /**
         * Toggles between snippet and full text view
         */
        function toggleFullTextPreview() {
            const snippet = document.getElementById('rfp-text-preview-snippet');
            const full = document.getElementById('rfp-text-preview-full');
            const toggle = document.getElementById('rfp-full-text-toggle');
            
            if (full.style.display === 'none') {
                snippet.style.display = 'none';
                full.style.display = 'block';
                toggle.textContent = 'Hide';
            } else {
                snippet.style.display = 'block';
                full.style.display = 'none';
                toggle.textContent = 'Show';
            }
        }

        /**
         * Copies extracted text to clipboard
         */
        async function copyExtractedText() {
            if (!rfpState.extractedText) return;
            
            try {
                await navigator.clipboard.writeText(rfpState.extractedText);
                const btn = event.target;
                const originalText = btn.textContent;
                btn.textContent = 'Copied!';
                btn.style.color = '#00ff00';
                setTimeout(() => {
                    btn.textContent = originalText;
                    btn.style.color = '';
                }, 2000);
            } catch (error) {
                alert('Failed to copy text. Please select and copy manually.');
            }
        }

        /**
         * Analyzes the RFP document with OpenAI (with chunking support)
         */
        async function analyzeRfpDocument() {
            const apiKey = getValidApiKey();
            if (!apiKey) {
                alert('Please set your OpenAI API key first. Click the chat button and enter your key.');
                return;
            }
            
            // Go to stage 3 and show loading
            goToRfpStage(3);
            document.getElementById('rfp-loading').classList.add('visible');
            document.getElementById('rfp-preview').style.display = 'none';
            
            try {
                let text;
                
                // Use already-extracted text if available (from preview), otherwise extract now
                if (rfpState.extractedText) {
                    text = rfpState.extractedText;
                    document.querySelector('.rfp-loading-text').textContent = `Using extracted text (${formatNumber(text.length)} chars). Analyzing with AI...`;
                } else {
                    // Extract text from selected pages
                    const pageRange = document.getElementById('rfp-page-range').value;
                    const pages = parsePageRange(pageRange, rfpState.pageCount);
                    
                    document.querySelector('.rfp-loading-text').textContent = `Extracting text from ${pages.length} pages...`;
                    
                    text = await extractPdfText(rfpState.file, pages);
                    rfpState.extractedText = text;
                }
                
                // GPT-4o-mini supports 128K tokens (~500K chars), but we need buffer for system prompt + response
                // Using 400K chars (~100K tokens) leaves room for: system prompt (~1.5K tokens) + response (1.5K tokens) + buffer
                const MAX_TEXT_LENGTH = 400000;
                const needsChunking = text.length > MAX_TEXT_LENGTH;
                
                // Store truncation status for display in preview
                rfpState.wasTruncated = false; // No longer truncating, we chunk instead
                rfpState.originalLength = text.length;
                rfpState.analyzedLength = text.length; // We analyze everything now
                rfpState.chunkCount = 1;
                
                // Reset usage stats for this analysis run
                rfpState.usageStats = {
                    totalPromptTokens: 0,
                    totalCompletionTokens: 0,
                    totalTokens: 0,
                    apiCalls: 0,
                    estimatedCost: 0,
                    model: 'gpt-5.2-thinking',
                    startTime: Date.now(),
                    endTime: null
                };
                
                let extracted;
                
                if (needsChunking) {
                    // Split into chunks
                    const chunks = splitTextIntoChunks(text, MAX_TEXT_LENGTH);
                    rfpState.chunkCount = chunks.length;

                    document.querySelector('.rfp-loading-text').textContent = `Document is large (${formatNumber(text.length)} chars). Analyzing ${chunks.length} chunks with optimized processing...`;

                    // Analyze chunks sequentially to avoid HTTP/2 protocol errors
                    const chunkResults = [];
                    const analysisStartTime = Date.now();
                    for (let i = 0; i < chunks.length; i++) {
                        const avgTime = i > 0 ? ((Date.now() - analysisStartTime) / i / 1000).toFixed(1) : '?';
                        document.querySelector('.rfp-loading-text').textContent = `Analyzing chunk ${i + 1}/${chunks.length} (avg ${avgTime}s/chunk, optimized prompts)...`;

                        // analyzeChunk now has its own internal retry logic with exponential backoff
                        const result = await analyzeChunk(apiKey, chunks[i], i, chunks.length);
                        
                        // Accumulate usage stats from each chunk
                        if (result.usage) {
                            rfpState.usageStats.totalPromptTokens += result.usage.prompt_tokens || 0;
                            rfpState.usageStats.totalCompletionTokens += result.usage.completion_tokens || 0;
                            rfpState.usageStats.totalTokens += result.usage.total_tokens || 0;
                            rfpState.usageStats.apiCalls++;
                        }
                        if (result.model) {
                            rfpState.usageStats.model = result.model;
                        }
                        
                        chunkResults.push(result);
                    }

                    // Merge results - Step 1: Local merge (free, instant)
                    document.querySelector('.rfp-loading-text').textContent = `Merging results: Local merge of arrays (instant)...`;
                    await new Promise(r => setTimeout(r, 100)); // Brief pause to show message

                    // Step 2: AI merge for complex fields only
                    document.querySelector('.rfp-loading-text').textContent = `Merging results: AI merge of complex fields (optimized)...`;
                    const mergeResult = await mergeChunkResults(apiKey, chunkResults);
                    
                    // Accumulate usage stats from merge call
                    if (mergeResult.usage) {
                        rfpState.usageStats.totalPromptTokens += mergeResult.usage.prompt_tokens || 0;
                        rfpState.usageStats.totalCompletionTokens += mergeResult.usage.completion_tokens || 0;
                        rfpState.usageStats.totalTokens += mergeResult.usage.total_tokens || 0;
                        rfpState.usageStats.apiCalls++;
                    }
                    
                    extracted = mergeResult.data;
                    
                } else {
                    // Single chunk - use original approach
                    document.querySelector('.rfp-loading-text').textContent = `Analyzing ${formatNumber(text.length)} characters with AI...`;
                    const result = await analyzeChunk(apiKey, text, 0, 1);
                    
                    // Accumulate usage stats
                    if (result.usage) {
                        rfpState.usageStats.totalPromptTokens += result.usage.prompt_tokens || 0;
                        rfpState.usageStats.totalCompletionTokens += result.usage.completion_tokens || 0;
                        rfpState.usageStats.totalTokens += result.usage.total_tokens || 0;
                        rfpState.usageStats.apiCalls++;
                    }
                    if (result.model) {
                        rfpState.usageStats.model = result.model;
                    }
                    
                    extracted = result.data;
                }
                
                // Record end time and calculate cost
                rfpState.usageStats.endTime = Date.now();
                
                // Estimate cost based on GPT-5.2 pricing (adjust as needed)
                // Assuming: $5/1M input tokens, $15/1M output tokens
                const inputCostPer1M = 5.00;
                const outputCostPer1M = 15.00;
                rfpState.usageStats.estimatedCost = 
                    (rfpState.usageStats.totalPromptTokens / 1000000 * inputCostPer1M) + 
                    (rfpState.usageStats.totalCompletionTokens / 1000000 * outputCostPer1M);
                
                console.log('Final usage stats:', rfpState.usageStats);
                console.log('Extracted data before storing:', extracted);
                console.log('Extracted quantities:', extracted?.quantities);
                console.log('Extracted projectInfo:', extracted?.projectInfo);
                
                rfpState.extractedData = extracted;
                displayRfpPreview(extracted);
                
            } catch (error) {
                console.error('RFP analysis error:', error);
                
                // Provide user-friendly error message with suggestions
                let errorMsg = 'Error analyzing document:\n\n' + error.message;
                
                if (error.message.includes('Failed to fetch') || 
                    error.message.includes('NetworkError') || 
                    error.message.includes('ERR_') ||
                    error.message.includes('Network error')) {
                    errorMsg += '\n\n💡 Suggestions:\n' +
                        '• Check your internet connection\n' +
                        '• Try disabling browser extensions (especially ad blockers)\n' +
                        '• Try using an incognito/private window\n' +
                        '• If on a corporate network, contact your IT team\n' +
                        '• Wait a moment and try again';
                }
                
                alert(errorMsg);
                goToRfpStage(2);
            }
        }

        /**
         * Displays the extracted data in the preview UI
         */
        function displayRfpPreview(data) {
            document.getElementById('rfp-loading').classList.remove('visible');
            document.getElementById('rfp-preview').style.display = 'block';
            
            // Populate fields
            document.getElementById('rfp-preview-phases').value = (data.phases || []).join(', ');
            document.getElementById('rfp-preview-disciplines').value = (data.disciplines || []).join(', ');
            document.getElementById('rfp-preview-packages').value = (data.packages || []).join(', ');
            
            // Discipline Scopes
            const scopesContainer = document.getElementById('rfp-discipline-scopes-container');
            scopesContainer.innerHTML = '';
            
            if (data.disciplineScopes && Object.keys(data.disciplineScopes).length > 0) {
                // Show scopes for disciplines that have scope info
                Object.entries(data.disciplineScopes).forEach(([disc, scope]) => {
                    const scopeItem = document.createElement('div');
                    scopeItem.className = 'rfp-discipline-scope-item';
                    scopeItem.innerHTML = `
                        <div class="rfp-discipline-scope-name">${disc}</div>
                        <textarea class="rfp-discipline-scope-textarea" data-discipline="${disc}" placeholder="Scope of work for ${disc}...">${scope || ''}</textarea>
                    `;
                    scopesContainer.appendChild(scopeItem);
                });
                
                // Also add disciplines that don't have scope yet (so user can add)
                const disciplinesWithScopes = Object.keys(data.disciplineScopes);
                (data.disciplines || []).forEach(disc => {
                    if (!disciplinesWithScopes.includes(disc)) {
                        const scopeItem = document.createElement('div');
                        scopeItem.className = 'rfp-discipline-scope-item';
                        scopeItem.innerHTML = `
                            <div class="rfp-discipline-scope-name">${disc}</div>
                            <textarea class="rfp-discipline-scope-textarea" data-discipline="${disc}" placeholder="No scope found for ${disc}. Add scope if known..."></textarea>
                        `;
                        scopesContainer.appendChild(scopeItem);
                    }
                });
            } else {
                // No discipline scopes extracted - show disciplines with empty fields
                (data.disciplines || []).forEach(disc => {
                    const scopeItem = document.createElement('div');
                    scopeItem.className = 'rfp-discipline-scope-item';
                    scopeItem.innerHTML = `
                        <div class="rfp-discipline-scope-name">${disc}</div>
                        <textarea class="rfp-discipline-scope-textarea" data-discipline="${disc}" placeholder="No scope found for ${disc}. Add scope if known..."></textarea>
                    `;
                    scopesContainer.appendChild(scopeItem);
                });
            }
            
            // Scope Summary
            document.getElementById('rfp-preview-scope').value = data.scope || '';
            
            // Schedule
            document.getElementById('rfp-preview-schedule').value = data.schedule || '';
            
            // Confidence indicators
            const conf = data.confidence || {};
            setConfidenceIndicator('rfp-conf-phases', conf.phases);
            setConfidenceIndicator('rfp-conf-disciplines', conf.disciplines);
            setConfidenceIndicator('rfp-conf-packages', conf.packages);
            setConfidenceIndicator('rfp-conf-scope', conf.scope);
            setConfidenceIndicator('rfp-conf-schedule', conf.schedule);
            setConfidenceIndicator('rfp-conf-quantities', conf.quantities);
            
            // Quantities Section
            displayRfpQuantities(data.quantities, data.projectInfo, conf.quantities);
            
            // Chunking notice (if document was chunked)
            if (rfpState.chunkCount > 1) {
                const truncationNotice = document.getElementById('rfp-truncation-notice');
                const truncationText = document.getElementById('rfp-truncation-text');
                truncationNotice.style.display = 'block';
                truncationText.textContent = `Large document analyzed in ${rfpState.chunkCount} chunks (${formatNumber(rfpState.originalLength)} total characters). All content was analyzed and merged for comprehensive results.`;
            } else {
                document.getElementById('rfp-truncation-notice').style.display = 'none';
            }
            
            // Notes
            if (data.notes) {
                document.getElementById('rfp-notes').style.display = 'block';
                document.getElementById('rfp-notes-text').textContent = data.notes;
            } else {
                document.getElementById('rfp-notes').style.display = 'none';
            }
            
            // Risks
            const risksSection = document.getElementById('rfp-risks');
            const risksList = document.getElementById('rfp-risks-list');
            
            if (data.risks && data.risks.length > 0) {
                risksSection.style.display = 'block';
                risksList.innerHTML = data.risks.map(risk => {
                    const severity = (risk.severity || 'Medium').toLowerCase();
                    return `
                        <div class="rfp-risk-item severity-${severity}">
                            <div class="rfp-risk-header">
                                <span class="rfp-risk-category">${risk.category || 'General'}</span>
                                <span class="rfp-risk-severity ${severity}">${(risk.severity || 'Medium').toUpperCase()}</span>
                            </div>
                            <div class="rfp-risk-description">${escapeHtml(risk.description || '')}</div>
                            ${risk.mitigation ? `<div class="rfp-risk-mitigation">${escapeHtml(risk.mitigation)}</div>` : ''}
                        </div>
                    `;
                }).join('');
            } else {
                risksSection.style.display = 'none';
            }
            
            // Usage Statistics
            const stats = rfpState.usageStats;
            if (stats && stats.totalTokens > 0) {
                document.getElementById('rfp-usage-stats').style.display = 'block';
                document.getElementById('rfp-stats-calls').textContent = stats.apiCalls;
                document.getElementById('rfp-stats-model').textContent = stats.model || 'gpt-5.2';
                document.getElementById('rfp-stats-prompt').textContent = formatNumber(stats.totalPromptTokens);
                document.getElementById('rfp-stats-completion').textContent = formatNumber(stats.totalCompletionTokens);
                document.getElementById('rfp-stats-tokens').textContent = formatNumber(stats.totalTokens);
                
                // Calculate processing time
                if (stats.startTime && stats.endTime) {
                    const durationMs = stats.endTime - stats.startTime;
                    const durationSec = (durationMs / 1000).toFixed(1);
                    document.getElementById('rfp-stats-time').textContent = `${durationSec}s`;
                }
                
                // Format cost
                document.getElementById('rfp-stats-cost').textContent = `$${stats.estimatedCost.toFixed(4)}`;
            } else {
                document.getElementById('rfp-usage-stats').style.display = 'none';
            }
        }

        /**
         * Display extracted quantities in the RFP preview
         */
        function displayRfpQuantities(quantities, projectInfo, confidenceLevel) {
            console.log('displayRfpQuantities called with:', { quantities, projectInfo, confidenceLevel });
            
            const section = document.getElementById('rfp-quantities-section');
            const grid = document.getElementById('rfp-quantities-grid');
            
            if (!section || !grid) {
                console.error('displayRfpQuantities: Section or grid element not found');
                return;
            }
            
            // Quantity field definitions with labels and units
            const quantityFields = [
                { key: 'alignmentLengthLF', label: 'Alignment Length (Wall Projects)', unit: 'LF' },
                { key: 'barrierLengthLF', label: 'Barrier Length (Wall Projects)', unit: 'LF' },
                { key: 'roadwayLengthLF', label: 'Roadway Length', unit: 'LF' },
                { key: 'projectAreaAC', label: 'Project Area', unit: 'AC' },
                { key: 'wallAreaSF', label: 'Retaining Wall Area', unit: 'SF' },
                { key: 'noiseWallAreaSF', label: 'Noise Wall Area', unit: 'SF' },
                { key: 'bridgeDeckAreaSF', label: 'Bridge Deck Area', unit: 'SF' },
                { key: 'bridgeCount', label: 'Bridge Count', unit: 'EA' },
                { key: 'structureCount', label: 'Structure Count', unit: 'EA' },
                { key: 'utilityRelocations', label: 'Utility Relocations', unit: 'EA' },
                { key: 'permitCount', label: 'Permit Count', unit: 'EA' },
                { key: 'trackLengthTF', label: 'Track Length', unit: 'TF' }
            ];
            
            const qty = quantities || {};
            const info = projectInfo || {};
            
            // Check if any quantities were extracted
            const hasQuantities = Object.values(qty).some(v => v > 0);
            const hasProjectInfo = info.projectCostM > 0 || (info.designDurationMonths && info.designDurationMonths !== 20);
            
            // Always show the section so users can enter quantities manually
            // Visual indicator shows whether AI extracted values or not
            section.style.display = 'block';
            
            // Update section header to indicate if quantities were found
            const sectionHeader = section.querySelector('h4');
            if (sectionHeader) {
                if (hasQuantities || hasProjectInfo) {
                    sectionHeader.innerHTML = '📐 Quantity Estimates for MH Benchmark <span id="rfp-conf-quantities" class="rfp-confidence medium">MED</span>';
                } else {
                    sectionHeader.innerHTML = '📐 Quantity Estimates <span style="color: #ff8800; font-size: 10px; margin-left: 8px;">(No quantities found - enter manually)</span>';
                }
            }
            
            // Get reasoning data
            const reasoning = rfpState.extractedData?.quantityReasoning || {};
            
            // Build quantity inputs with reasoning tooltips
            grid.innerHTML = quantityFields.map(field => {
                const value = qty[field.key] || 0;
                const hasValue = value > 0;
                const fieldReasoning = reasoning[field.key] || '';
                const hasReasoning = fieldReasoning.length > 0;
                
                return `
                    <div class="rfp-quantity-item ${hasValue ? 'has-value' : ''}" ${hasReasoning ? `title="${fieldReasoning.replace(/"/g, '&quot;')}"` : ''}>
                        <label>${field.label}${hasReasoning ? ' <span class="reasoning-indicator" onclick="showQuantityReasoning(\'${field.key}\', \'${field.label}\')">💡</span>' : ''}</label>
                        <input type="text" id="rfp-qty-${field.key}" 
                               value="${hasValue ? formatNumber(value) : '0'}" 
                               inputmode="numeric"
                               onchange="updateRfpQuantity('${field.key}', this.value)">
                        <div class="qty-unit">${field.unit}</div>
                        ${hasReasoning ? `<div class="qty-reasoning" id="rfp-reasoning-${field.key}">${fieldReasoning}</div>` : ''}
                    </div>
                `;
            }).join('');
            
            // Populate project info fields
            if (info.projectCostM > 0) {
                document.getElementById('rfp-qty-projectCostM').value = info.projectCostM.toFixed(1);
            }
            if (info.designDurationMonths) {
                document.getElementById('rfp-qty-designDurationMonths').value = info.designDurationMonths;
            }
            if (info.projectType) {
                document.getElementById('rfp-qty-projectType').value = info.projectType;
            }
            if (info.complexity) {
                document.getElementById('rfp-qty-complexity').value = info.complexity;
            }
            
            // Display AI reasoning for project cost and schedule
            displayProjectInfoReasoning();
        }
        
        /**
         * Display AI reasoning for project cost and schedule estimates
         */
        function displayProjectInfoReasoning() {
            const projectInfoReasoning = rfpState.extractedData?.projectInfoReasoning || {};
            const scheduleReasoning = rfpState.extractedData?.scheduleReasoning || projectInfoReasoning.scheduleReasoning || '';
            const costReasoning = projectInfoReasoning.projectCostReasoning || '';
            
            // Find or create the reasoning container
            let reasoningContainer = document.getElementById('rfp-project-reasoning-container');
            if (!reasoningContainer) {
                const projectInfoSection = document.getElementById('rfp-project-info-section');
                if (projectInfoSection) {
                    reasoningContainer = document.createElement('div');
                    reasoningContainer.id = 'rfp-project-reasoning-container';
                    projectInfoSection.appendChild(reasoningContainer);
                }
            }
            
            if (reasoningContainer) {
                let html = '';
                
                if (costReasoning) {
                    html += `
                        <div class="rfp-project-cost-reasoning">
                            <h5>💰 Construction Cost Reasoning</h5>
                            ${costReasoning}
                        </div>
                    `;
                }
                
                if (scheduleReasoning) {
                    html += `
                        <div class="rfp-schedule-reasoning">
                            <h5>📅 Schedule Duration Reasoning</h5>
                            ${scheduleReasoning}
                        </div>
                    `;
                }
                
                reasoningContainer.innerHTML = html;
            }
        }

        /**
         * Update a quantity value in rfpState
         */
        function updateRfpQuantity(key, value) {
            const numValue = parseFloat(value.replace(/[,$]/g, '')) || 0;
            if (!rfpState.extractedData) rfpState.extractedData = {};
            if (!rfpState.extractedData.quantities) rfpState.extractedData.quantities = {};
            rfpState.extractedData.quantities[key] = numValue;
            
            // Update display with formatting
            const input = document.getElementById(`rfp-qty-${key}`);
            if (input && numValue > 0) {
                input.value = formatNumber(numValue);
                input.closest('.rfp-quantity-item').classList.add('has-value');
            } else if (input) {
                input.closest('.rfp-quantity-item').classList.remove('has-value');
            }
        }

        /**
         * Show quantity reasoning in an alert/popup
         */
        function showQuantityReasoning(key, label) {
            const reasoning = rfpState.extractedData?.quantityReasoning?.[key] || 'No reasoning available for this quantity.';
            alert(`AI Reasoning for ${label}:\n\n${reasoning}`);
        }
        
        /**
         * Sets the confidence indicator styling
         */
        function setConfidenceIndicator(elementId, level) {
            const el = document.getElementById(elementId);
            if (!el) return;
            
            el.classList.remove('high', 'medium', 'low');
            
            const normalizedLevel = (level || 'low').toLowerCase();
            el.classList.add(normalizedLevel);
            el.textContent = normalizedLevel.toUpperCase();
        }

        /**
         * Applies the extracted RFP data to the project
         */
        function applyRfpData() {
            // Get values from preview fields
            const phasesStr = document.getElementById('rfp-preview-phases').value;
            const disciplinesStr = document.getElementById('rfp-preview-disciplines').value;
            const packagesStr = document.getElementById('rfp-preview-packages').value;
            const scopeStr = document.getElementById('rfp-preview-scope').value;
            const scheduleStr = document.getElementById('rfp-preview-schedule').value;
            
            // Get discipline scopes from textarea fields
            const disciplineScopes = {};
            document.querySelectorAll('.rfp-discipline-scope-textarea').forEach(textarea => {
                const disc = textarea.getAttribute('data-discipline');
                const scope = textarea.value.trim();
                if (disc && scope) {
                    disciplineScopes[disc] = scope;
                }
            });
            
            // Parse phases
            const phases = phasesStr.split(',').map(s => s.trim()).filter(s => s);
            
            // Parse disciplines
            const disciplines = disciplinesStr.split(',').map(s => s.trim()).filter(s => s);
            
            // Parse packages
            const packages = packagesStr.split(',').map(s => s.trim()).filter(s => s);
            
            // Update projectData
            projectData.phases = phases.length > 0 ? phases : ['Base'];
            projectData.disciplines = disciplines.length > 0 ? disciplines : [];
            projectData.packages = packages.length > 0 ? packages : ['Preliminary', 'Final'];
            
            // Store scope information
            projectData.projectScope = scopeStr || '';
            projectData.scheduleNotes = scheduleStr || '';
            projectData.disciplineScopes = disciplineScopes;
            
            // Store RFP-extracted review steps
            if (rfpState.extractedData && rfpState.extractedData.reviewSteps) {
                projectData.rfpReviewSteps = rfpState.extractedData.reviewSteps;
            }
            
            // Clear existing review steps so they get regenerated with RFP data
            projectData.reviewSteps = {};
            
            // Transfer extracted project info to projectData
            if (rfpState.projectInfo) {
                projectData.projectInfo.projectName = rfpState.projectInfo.projectName || projectData.projectInfo.projectName;
                projectData.projectInfo.projectLocation = rfpState.projectInfo.projectLocation || projectData.projectInfo.projectLocation;
                projectData.projectInfo.technicalProposalDue = rfpState.projectInfo.technicalProposalDue || '';
                projectData.projectInfo.priceProposalDue = rfpState.projectInfo.priceProposalDue || '';
                projectData.projectInfo.interviewDate = rfpState.projectInfo.interviewDate || '';
                projectData.projectInfo.contractAward = rfpState.projectInfo.contractAward || '';
                projectData.projectInfo.noticeToProceed = rfpState.projectInfo.noticeToProceed || '';
                projectData.projectInfo.stipendAmount = rfpState.projectInfo.stipendAmount || '';
                projectData.projectInfo.ownerContractType = rfpState.projectInfo.ownerContractType || '';
                projectData.projectInfo.evaluationCriteria = rfpState.projectInfo.evaluationCriteria || '';
                projectData.projectInfo.dbeGoals = rfpState.projectInfo.dbeGoals || '';
            }
            
            // Transfer extracted commercial terms to projectData
            if (rfpState.commercialTerms) {
                projectData.commercialTerms = { ...projectData.commercialTerms, ...rfpState.commercialTerms };
            }
            
            // Set all budgets to 0 - user will set via Cost Estimator in Step 4
            projectData.budgets = {};
            disciplines.forEach(disc => {
                projectData.budgets[disc] = 0;
            });
            
            // Initialize claiming (even distribution)
            const claimPerPackage = Math.floor(100 / projectData.packages.length);
            const remainder = 100 - (claimPerPackage * projectData.packages.length);
            
            projectData.claiming = {};
            projectData.disciplines.forEach(disc => {
                projectData.packages.forEach((pkg, i) => {
                    const key = `${disc}-${pkg}`;
                    projectData.claiming[key] = claimPerPackage + (i === projectData.packages.length - 1 ? remainder : 0);
                });
            });
            
            // Initialize dates (placeholder, spread across 6 months)
            const today = new Date();
            projectData.dates = {};
            projectData.disciplines.forEach(disc => {
                projectData.packages.forEach((pkg, i) => {
                    const key = `${disc}-${pkg}`;
                    const startOffset = i * 30;
                    const endOffset = startOffset + 28;
                    
                    const startDate = new Date(today);
                    startDate.setDate(startDate.getDate() + startOffset);
                    const endDate = new Date(today);
                    endDate.setDate(endDate.getDate() + endOffset);
                    
                    projectData.dates[key] = {
                        start: startDate.toISOString().split('T')[0],
                        end: endDate.toISOString().split('T')[0]
                    };
                });
            });
            
            // Update wizard UI
            document.getElementById('phases-input').value = projectData.phases.join(', ');
            document.getElementById('packages-input').value = projectData.packages.join(', ');
            
            // Update disciplines grid
            const grid = document.getElementById('disciplines-grid');
            grid.innerHTML = '';
            
            // First add existing disciplines, marking selected ones
            allDisciplines.forEach(d => {
                const isSelected = projectData.disciplines.includes(d.name);
                grid.innerHTML += `<div class="disc-item ${isSelected ? 'selected' : ''}" onclick="toggleDisc(this)" data-name="${d.name}">${d.name}</div>`;
            });
            
            // Add any custom disciplines from RFP
            projectData.disciplines.forEach(disc => {
                if (!allDisciplines.find(d => d.name === disc)) {
                    grid.innerHTML += `<div class="disc-item selected" onclick="toggleDisc(this)" data-name="${disc}">${disc}</div>`;
                    // Add to example budgets
                    if (!exampleBudgets[disc]) {
                        exampleBudgets[disc] = projectData.budgets[disc] || 100000;
                    }
                }
            });
            
            updateSelectedCount();
            
            // Apply extracted quantities to MH Estimator
            applyRfpQuantitiesToEstimator();

            // Populate Cost Estimator fields from RFP data
            populateCostEstimatorFromRfp();

            // Trigger autosave with RFP data
            triggerAutosave();
            
            // Close modal and go to Benchmarking (first visual step)
            closeRfpWizard();

            // Reset to Benchmarking step
            currentStep = 4;
            showStep(4);
            
            // Build success message including quantity info
            let quantityInfo = '';
            if (rfpState.quantities) {
                const qtyCount = Object.values(rfpState.quantities).filter(v => v > 0).length;
                if (qtyCount > 0) {
                    quantityInfo = `\n• ${qtyCount} quantity estimates applied to MH Estimator`;
                }
            }
            
            // Get confidence level for user feedback
            const confidenceLevel = rfpState.extractedData?.confidence?.quantities || 'low';
            const confidenceMsg = {
                'high': 'Quantities are based on explicit RFP values.',
                'medium': 'Quantities are estimated from RFP context. Review recommended.',
                'low': 'Quantities are rough estimates. Manual adjustment recommended.'
            }[confidenceLevel] || 'Manual adjustment recommended.';
            
            // Show success message
            alert(`RFP data imported successfully!\n\n• ${projectData.phases.length} phases\n• ${projectData.disciplines.length} disciplines\n• ${projectData.packages.length} packages${quantityInfo}\n\n${confidenceMsg}\n\nCheck the MH Benchmark Estimator in Step 4 to review quantities.`);
            
            // Show RFP Results button in header for easy reference
            showRfpResultsButton();
        }

        /**
         * Populates Cost Estimator fields from RFP-extracted data
         */
        function populateCostEstimatorFromRfp() {
            if (!rfpState.extractedData || !rfpState.extractedData.projectInfo) {
                return;
            }

            const projectInfo = rfpState.extractedData.projectInfo;

            // Populate Estimated Construction Cost
            const estConstructionCostField = document.getElementById('calc-est-construction-cost');
            if (estConstructionCostField && projectInfo.projectCostM) {
                // Convert from millions to dollars
                const costInDollars = projectInfo.projectCostM * 1000000;
                estConstructionCostField.value = formatCurrency(costInDollars);
            }

            // Populate NTP Date
            const ntpDateField = document.getElementById('calc-ntp-date');
            if (ntpDateField && projectInfo.noticeToProceed) {
                ntpDateField.value = projectInfo.noticeToProceed;
            }

            // Populate Design Duration
            const designDurationField = document.getElementById('calc-design-duration');
            if (designDurationField && projectInfo.designDurationMonths) {
                // Convert months to days (approximate: 30 days per month)
                const durationInDays = projectInfo.designDurationMonths * 30;
                designDurationField.value = durationInDays.toString();
            }
        }

        /**
         * Read quantity values from RFP preview input fields
         */
        function readRfpQuantityFields() {
            const quantityKeys = [
                'alignmentLengthLF', 'barrierLengthLF',
                'roadwayLengthLF', 'projectAreaAC', 'wallAreaSF', 'noiseWallAreaSF',
                'bridgeDeckAreaSF', 'bridgeCount', 'structureCount', 'utilityRelocations',
                'permitCount', 'trackLengthTF'
            ];
            
            const quantities = {};
            quantityKeys.forEach(key => {
                const input = document.getElementById(`rfp-qty-${key}`);
                if (input) {
                    quantities[key] = parseFloat(input.value.replace(/[,$]/g, '')) || 0;
                } else {
                    // Fall back to extracted data
                    quantities[key] = rfpState.extractedData?.quantities?.[key] || 0;
                }
            });
            
            return quantities;
        }

        /**
         * Read project info values from RFP preview input fields
         */
        function readRfpProjectInfoFields() {
            const costInput = document.getElementById('rfp-qty-projectCostM');
            const durationInput = document.getElementById('rfp-qty-designDurationMonths');
            const typeInput = document.getElementById('rfp-qty-projectType');
            const complexityInput = document.getElementById('rfp-qty-complexity');
            
            return {
                projectCostM: costInput ? parseFloat(costInput.value) || 0 : (rfpState.extractedData?.projectInfo?.projectCostM || 0),
                designDurationMonths: durationInput ? parseInt(durationInput.value) || 20 : (rfpState.extractedData?.projectInfo?.designDurationMonths || 20),
                projectType: typeInput ? typeInput.value : (rfpState.extractedData?.projectInfo?.projectType || 'highway'),
                complexity: complexityInput ? complexityInput.value : (rfpState.extractedData?.projectInfo?.complexity || 'Medium')
            };
        }

        /**
         * Apply RFP-extracted quantities to the MH Estimator
         */
        function applyRfpQuantitiesToEstimator() {
            if (!rfpState.extractedData) {
                console.log('applyRfpQuantitiesToEstimator: No extractedData found');
                return;
            }

            console.log('applyRfpQuantitiesToEstimator: Starting with extractedData:', rfpState.extractedData);

            // Read user-edited values from the RFP preview fields
            const quantities = readRfpQuantityFields();
            const projectInfo = readRfpProjectInfoFields();

            console.log('applyRfpQuantitiesToEstimator: Read quantities from fields:', quantities);
            console.log('applyRfpQuantitiesToEstimator: Read projectInfo from fields:', projectInfo);

            // Check if this is a Wall project and switch dataset if needed
            const isWallProject = rfpState.extractedData.wallProject === true;
            if (isWallProject) {
                console.log('RFP indicates Wall project - switching to border-wall dataset');
                const datasetSelect = document.getElementById('benchmark-dataset');
                if (datasetSelect && datasetSelect.value !== 'border-wall') {
                    datasetSelect.value = 'border-wall';
                    // Trigger the dataset change handler to reload benchmark data
                    const event = new Event('change');
                    datasetSelect.dispatchEvent(event);
                }
            }

            // Store in rfpState for reference
            rfpState.quantities = quantities;
            rfpState.projectInfo = projectInfo;
            rfpState.extractedData.quantities = quantities;
            rfpState.extractedData.projectInfo = projectInfo;
            
            // Also store commercial terms if available
            if (rfpState.extractedData.commercialTerms) {
                rfpState.commercialTerms = rfpState.extractedData.commercialTerms;
                rfpState.commercialTermsConfidence = rfpState.extractedData.commercialTermsConfidence || {};
            }
            
            // Apply project cost to BOTH MH Estimator and Budget Calculator
            if (projectInfo.projectCostM && projectInfo.projectCostM > 0) {
                const costValue = projectInfo.projectCostM * 1000000; // Convert M to $
                
                // Apply to MH Estimator
                const mhCostInput = document.getElementById('mh-project-cost');
                if (mhCostInput) {
                    mhCostInput.value = costValue.toLocaleString('en-US');
                    mhEstimateState.projectCost = costValue;
                }
                
                // Apply to Budget Calculator (Cost Estimator Module)
                const calcCostInput = document.getElementById('calc-construction-cost');
                if (calcCostInput) {
                    calcCostInput.value = costValue.toLocaleString('en-US');
                    projectData.calculator.totalConstructionCost = costValue;
                }
            }
            
            // Apply design duration
            if (projectInfo.designDurationMonths) {
                const durationInput = document.getElementById('mh-design-duration');
                if (durationInput) {
                    durationInput.value = projectInfo.designDurationMonths;
                    mhEstimateState.designDuration = projectInfo.designDurationMonths;
                }
            }
            
            // Apply project type
            if (projectInfo.projectType) {
                const typeInput = document.getElementById('mh-project-type');
                if (typeInput) {
                    typeInput.value = projectInfo.projectType;
                }
            }
            
            // Apply complexity
            if (projectInfo.complexity) {
                const complexityMap = {
                    'Low': 'Low',
                    'Medium': 'Med',
                    'High': 'High'
                };
                const complexityInput = document.getElementById('mh-complexity');
                if (complexityInput) {
                    complexityInput.value = complexityMap[projectInfo.complexity] || 'Med';
                    mhEstimateState.complexity = complexityInput.value;
                }
            }
            
            // Get RFP quantity reasoning
            const quantityReasoning = rfpState.extractedData?.quantityReasoning || {};

            // Map RFP quantities to MH estimator disciplines with reasoning keys
            let quantityMapping = {};

            if (isWallProject) {
                // Wall Projects: map to alignment and barrier length disciplines
                // The discipline IDs are generated by parseWallFormat and follow the pattern:
                // {base_name}_{metric_name} (e.g., drainage_design_alignment_length_lf)
                quantityMapping = {
                    // Drainage - both metrics
                    'drainage_design_alignment_length_lf': {
                        qty: quantities.alignmentLengthLF || 0,
                        reasoningKey: 'alignmentLengthLF',
                        note: 'Alignment length for drainage design'
                    },
                    'drainage_design_barrier_length_lf': {
                        qty: quantities.barrierLengthLF || 0,
                        reasoningKey: 'barrierLengthLF',
                        note: 'Barrier length for drainage design'
                    },
                    // Roadway - both metrics
                    'roadway_civil_design_alignment_length_lf': {
                        qty: quantities.alignmentLengthLF || 0,
                        reasoningKey: 'alignmentLengthLF',
                        note: 'Alignment length for roadway/civil design'
                    },
                    'roadway_civil_design_barrier_length_lf': {
                        qty: quantities.barrierLengthLF || 0,
                        reasoningKey: 'barrierLengthLF',
                        note: 'Barrier length for roadway/civil design'
                    },
                    // Geotechnical - both metrics
                    'geotechnical_design_alignment_length_lf': {
                        qty: quantities.alignmentLengthLF || 0,
                        reasoningKey: 'alignmentLengthLF',
                        note: 'Alignment length for geotechnical design'
                    },
                    'geotechnical_design_barrier_length_lf': {
                        qty: quantities.barrierLengthLF || 0,
                        reasoningKey: 'barrierLengthLF',
                        note: 'Barrier length for geotechnical design'
                    }
                };
            } else {
                // Highway/Bridge Projects: standard mapping
                quantityMapping = {
                    'roadway': { qty: quantities.roadwayLengthLF || 0, reasoningKey: 'roadwayLengthLF' },
                    'drainage': { qty: quantities.projectAreaAC || 0, reasoningKey: 'projectAreaAC' },
                    'mot': { qty: quantities.roadwayLengthLF || 0, reasoningKey: 'roadwayLengthLF', note: 'Same as roadway alignment length' },
                    'traffic': { qty: quantities.roadwayLengthLF || 0, reasoningKey: 'roadwayLengthLF', note: 'Same as roadway alignment length' },
                    'utilities': { qty: quantities.utilityRelocations || 0, reasoningKey: 'utilityRelocations' },
                    'retainingWalls': { qty: quantities.wallAreaSF || 0, reasoningKey: 'wallAreaSF' },
                    'noiseWalls': { qty: quantities.noiseWallAreaSF || 0, reasoningKey: 'noiseWallAreaSF' },
                    'bridgesPCGirder': { qty: Math.round((quantities.bridgeDeckAreaSF || 0) * 0.7), reasoningKey: 'bridgeDeckAreaSF', note: '70% of total bridge deck area assumed as PC Girder' },
                    'bridgesSteel': { qty: Math.round((quantities.bridgeDeckAreaSF || 0) * 0.2), reasoningKey: 'bridgeDeckAreaSF', note: '20% of total bridge deck area assumed as Steel' },
                    'bridgesRehab': { qty: Math.round((quantities.bridgeDeckAreaSF || 0) * 0.1), reasoningKey: 'bridgeDeckAreaSF', note: '10% of total bridge deck area assumed as Rehabilitation' },
                    'geotechnical': { qty: quantities.structureCount || quantities.bridgeCount || 0, reasoningKey: quantities.structureCount ? 'structureCount' : 'bridgeCount' },
                    'systems': { qty: quantities.trackLengthTF || 0, reasoningKey: 'trackLengthTF' },
                    'track': { qty: quantities.trackLengthTF || 0, reasoningKey: 'trackLengthTF' },
                    'environmental': { qty: quantities.permitCount || 0, reasoningKey: 'permitCount' }
                };
            }

            console.log('applyRfpQuantitiesToEstimator: quantityMapping:', quantityMapping);

            // Count how many disciplines will be updated
            let updatedCount = 0;

            // Apply quantities to each discipline
            for (const [discId, mapping] of Object.entries(quantityMapping)) {
                const qty = mapping.qty;
                console.log(`Checking discipline ${discId}: qty=${qty}, exists=${!!mhEstimateState.disciplines[discId]}`);
                if (qty > 0 && mhEstimateState.disciplines[discId]) {
                    updatedCount++;
                    const state = mhEstimateState.disciplines[discId];
                    state.active = true;
                    state.quantity = qty;

                    // Store RFP reasoning for this discipline
                    let reasoning = quantityReasoning[mapping.reasoningKey] || '';
                    if (mapping.note) {
                        reasoning = reasoning ? `${reasoning}\n\nNOTE: ${mapping.note}` : mapping.note;
                    }
                    state.rfpReasoning = reasoning;

                    // Calculate MH with bounds and rate stats
                    const result = estimateMH(discId, qty);
                    state.mh = result.mh;
                    state.rate = result.rate;
                    state.mhBounds = result.mhBounds;
                    state.rateStats = result.rateStats;
                    
                    // Update UI
                    updateMHRowDisplay(discId, state);
                }
            }
            
            // Recalculate project cost-based disciplines
            if (mhEstimateState.projectCost > 0) {
                updateMHProjectCost();
            }
            
            // Recalculate totals
            recalculateTotalMH();
            
            console.log('Applied RFP quantities to MH Estimator:', quantityMapping);
            console.log(`Updated ${updatedCount} disciplines in MH Estimator`);
            
            // Update status to show quantities were applied
            const statusEl = document.getElementById('mh-estimator-status');
            if (statusEl && updatedCount > 0) {
                statusEl.textContent = `${updatedCount} disciplines populated from RFP`;
                statusEl.style.color = '#4da6ff';
            }
        }
        
        /**
         * Re-applies RFP quantities to MH Estimator UI when navigating to Step 4
         * This ensures the UI displays correct values even if it wasn't rendered initially
         */
        function reapplyRfpQuantitiesToMHEstimator() {
            const quantities = rfpState.quantities || {};
            const projectInfo = rfpState.projectInfo || {};
            
            console.log('reapplyRfpQuantitiesToMHEstimator: Reapplying quantities:', quantities);
            
            // Re-apply project cost to both modules
            if (projectInfo.projectCostM && projectInfo.projectCostM > 0) {
                const costValue = projectInfo.projectCostM * 1000000;
                
                const mhCostInput = document.getElementById('mh-project-cost');
                if (mhCostInput && !mhCostInput.value) {
                    mhCostInput.value = costValue.toLocaleString('en-US');
                    mhEstimateState.projectCost = costValue;
                }
                
                const calcCostInput = document.getElementById('calc-construction-cost');
                if (calcCostInput && !calcCostInput.value) {
                    calcCostInput.value = costValue.toLocaleString('en-US');
                    projectData.calculator.totalConstructionCost = costValue;
                }
            }
            
            // Re-apply design duration
            if (projectInfo.designDurationMonths) {
                const durationInput = document.getElementById('mh-design-duration');
                if (durationInput) {
                    durationInput.value = projectInfo.designDurationMonths;
                    mhEstimateState.designDuration = projectInfo.designDurationMonths;
                }
            }
            
            // Map RFP quantities to MH estimator disciplines
            const quantityMapping = {
                'roadway': quantities.roadwayLengthLF || 0,
                'drainage': quantities.projectAreaAC || 0,
                'mot': quantities.roadwayLengthLF || 0,
                'traffic': quantities.roadwayLengthLF || 0,
                'utilities': quantities.utilityRelocations || 0,
                'retainingWalls': quantities.wallAreaSF || 0,
                'noiseWalls': quantities.noiseWallAreaSF || 0,
                'bridgesPCGirder': Math.round((quantities.bridgeDeckAreaSF || 0) * 0.7),
                'bridgesSteel': Math.round((quantities.bridgeDeckAreaSF || 0) * 0.2),
                'bridgesRehab': Math.round((quantities.bridgeDeckAreaSF || 0) * 0.1),
                'geotechnical': quantities.structureCount || quantities.bridgeCount || 0,
                'systems': quantities.trackLengthTF || 0,
                'track': quantities.trackLengthTF || 0,
                'environmental': quantities.permitCount || 0
            };
            
            let updatedCount = 0;
            
            for (const [discId, qty] of Object.entries(quantityMapping)) {
                if (qty > 0 && mhEstimateState.disciplines[discId]) {
                    updatedCount++;
                    const state = mhEstimateState.disciplines[discId];
                    state.active = true;
                    state.quantity = qty;
                    
                    // Calculate MH with bounds
                    const result = estimateMH(discId, qty);
                    state.mh = result.mh;
                    state.rate = result.rate;
                    state.mhBounds = result.mhBounds;
                    state.rateStats = result.rateStats;
                    
                    // Update UI
                    updateMHRowDisplay(discId, state);
                }
            }
            
            // Recalculate project cost-based disciplines
            if (mhEstimateState.projectCost > 0) {
                updateMHProjectCost();
            }
            
            // Recalculate totals
            recalculateTotalMH();
            
            // Update status
            const statusEl = document.getElementById('mh-estimator-status');
            if (statusEl && updatedCount > 0) {
                statusEl.textContent = `${updatedCount} disciplines populated from RFP`;
                statusEl.style.color = '#4da6ff';
            }
            
            console.log(`reapplyRfpQuantitiesToMHEstimator: Updated ${updatedCount} disciplines`);
        }

        // ============================================
        // MASTER REPORT DATA HELPERS
        // ============================================

        /**
         * Collects MH Estimator data for reporting
         * @returns {Object} MH estimate data including disciplines, totals, and rates
         */
        function getMHEstimatorData() {
            const activeDisciplines = [];
            let totalMH = 0;
            const hourlyRate = 150; // Default hourly rate
            
            for (const [discId, state] of Object.entries(mhEstimateState.disciplines || {})) {
                if (state.active && state.mh > 0) {
                    const discName = mapMHDisciplineToWBS(discId);
                    activeDisciplines.push({
                        id: discId,
                        name: discName,
                        quantity: state.quantity || 0,
                        rate: state.rate || 0,
                        mh: state.mh || 0,
                        budget: (state.mh || 0) * hourlyRate
                    });
                    totalMH += state.mh || 0;
                }
            }
            
            return {
                hasMHData: activeDisciplines.length > 0,
                projectCost: mhEstimateState.projectCost || 0,
                designDuration: mhEstimateState.designDuration || 20,
                complexity: mhEstimateState.complexity || 'Med',
                hourlyRate: hourlyRate,
                disciplines: activeDisciplines,
                totalMH: totalMH,
                totalBudget: totalMH * hourlyRate
            };
        }

        /**
         * Collects AI Insights data from the DOM
         * @returns {Object} AI insights including suggestions list
         */
        function getAIInsightsData() {
            const suggestionsList = document.getElementById('ai-suggestions-list');
            const insights = [];
            
            if (suggestionsList) {
                const items = suggestionsList.querySelectorAll('.suggestion-item');
                items.forEach(item => {
                    const icon = item.querySelector('.suggestion-icon')?.textContent || '💡';
                    const title = item.querySelector('.suggestion-title')?.textContent || '';
                    const desc = item.querySelector('.suggestion-desc')?.textContent || '';
                    if (title || desc) {
                        insights.push({ icon, title, description: desc });
                    }
                });
            }
            
            return {
                hasInsights: insights.length > 0,
                suggestions: insights
            };
        }

        /**
         * Collects schedule analysis data including AI rationale
         * @returns {Object} Schedule data with dates, duration, and AI rationale
         */
        function getScheduleAnalysisData() {
            let minDate = null, maxDate = null;
            const disciplineSchedules = [];
            
            // Collect all dates and build discipline schedules
            for (const disc of projectData.disciplines) {
                let discMinDate = null, discMaxDate = null;
                const packages = [];
                
                for (const pkg of projectData.packages) {
                    const key = `${disc}-${pkg}`;
                    const dates = projectData.dates[key];
                    if (dates && dates.start && dates.end) {
                        const start = new Date(dates.start);
                        const end = new Date(dates.end);
                        
                        if (!discMinDate || start < discMinDate) discMinDate = start;
                        if (!discMaxDate || end > discMaxDate) discMaxDate = end;
                        if (!minDate || start < minDate) minDate = start;
                        if (!maxDate || end > maxDate) maxDate = end;
                        
                        packages.push({
                            name: pkg,
                            start: dates.start,
                            end: dates.end,
                            duration: Math.ceil((end - start) / (1000 * 60 * 60 * 24))
                        });
                    }
                }
                
                if (packages.length > 0) {
                    disciplineSchedules.push({
                        discipline: disc,
                        startDate: discMinDate ? discMinDate.toISOString().split('T')[0] : null,
                        endDate: discMaxDate ? discMaxDate.toISOString().split('T')[0] : null,
                        duration: discMinDate && discMaxDate ? Math.ceil((discMaxDate - discMinDate) / (1000 * 60 * 60 * 24)) : 0,
                        packages: packages
                    });
                }
            }
            
            const totalDays = minDate && maxDate ? Math.ceil((maxDate - minDate) / (1000 * 60 * 60 * 24)) : 0;
            const totalMonths = Math.ceil(totalDays / 30);
            
            return {
                hasSchedule: disciplineSchedules.length > 0,
                startDate: minDate ? minDate.toISOString().split('T')[0] : null,
                endDate: maxDate ? maxDate.toISOString().split('T')[0] : null,
                totalDays: totalDays,
                totalMonths: totalMonths,
                disciplines: disciplineSchedules,
                scheduleNotes: projectData.scheduleNotes || '',
                aiScheduleRationale: rfpState?.projectInfoReasoning?.scheduleReasoning || ''
            };
        }

        /**
         * Gets RFP analysis data for reporting
         * @returns {Object} RFP extracted data
         */
        function getRfpAnalysisData() {
            const hasRfpData = rfpState && rfpState.extractedData && 
                (rfpState.extractedData.scope || rfpState.extractedData.disciplines?.length > 0);
            
            if (!hasRfpData) {
                return { hasRfpData: false };
            }
            
            const data = rfpState.extractedData || {};
            const quantities = rfpState.quantities || {};
            const projectInfo = rfpState.projectInfo || {};
            const quantityReasoning = rfpState.quantityReasoning || {};
            
            const quantityLabels = {
                roadwayLengthLF: { label: 'Roadway Length', unit: 'LF' },
                projectAreaAC: { label: 'Project Area', unit: 'AC' },
                wallAreaSF: { label: 'Retaining Wall Area', unit: 'SF' },
                noiseWallAreaSF: { label: 'Noise Wall Area', unit: 'SF' },
                bridgeDeckAreaSF: { label: 'Bridge Deck Area', unit: 'SF' },
                bridgeCount: { label: 'Number of Bridges', unit: '' },
                structureCount: { label: 'Number of Structures', unit: '' },
                utilityRelocations: { label: 'Utility Relocations', unit: '' },
                permitCount: { label: 'Permits Required', unit: '' },
                trackLengthTF: { label: 'Track Length', unit: 'TF' }
            };
            
            const activeQuantities = Object.entries(quantities)
                .filter(([k, v]) => v > 0)
                .map(([key, value]) => ({
                    key,
                    label: quantityLabels[key]?.label || key,
                    unit: quantityLabels[key]?.unit || '',
                    value,
                    reasoning: quantityReasoning[key] || ''
                }));
            
            return {
                hasRfpData: true,
                scope: data.scope || projectData.projectScope || '',
                schedule: data.schedule || projectData.scheduleNotes || '',
                disciplines: data.disciplines || [],
                disciplineScopes: data.disciplineScopes || projectData.disciplineScopes || {},
                phases: data.phases || [],
                packages: data.packages || [],
                risks: data.risks || [],
                quantities: activeQuantities,
                projectInfo: {
                    projectCostM: projectInfo.projectCostM || 0,
                    designDurationMonths: projectInfo.designDurationMonths || 0,
                    projectType: projectInfo.projectType || '',
                    complexity: projectInfo.complexity || ''
                },
                projectInfoReasoning: rfpState.projectInfoReasoning || {},
                confidence: data.confidence || {}
            };
        }

        // ============================================
        // DESIGN FEE BOOK REPORT
        // ============================================

        /**
         * Generates the Design Fee Book - a comprehensive 7-chapter professional report
         * Chapter structure per KEG Design Fee Book standards
         */
        function generateDesignFeeBook() {
            const today = new Date().toLocaleDateString();
            const todayFull = new Date().toLocaleDateString('en-US', { 
                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
            });
            
            // Collect all data
            const assumptions = getCostEstimateAssumptions();
            const totalBudget = calculateTotalBudget();
            const mhData = getMHEstimatorData();
            const aiInsights = getAIInsightsData();
            const scheduleData = getScheduleAnalysisData();
            const rfpData = getRfpAnalysisData();
            const wbsCount = projectData.phases.length * projectData.disciplines.length * projectData.packages.length;
            
            // Get project info from both projectData and rfpState
            const projectInfo = {
                ...projectData.projectInfo,
                ...(rfpState.projectInfo || {})
            };
            
            // Get commercial terms
            const commercialTerms = {
                ...projectData.commercialTerms,
                ...(rfpState.commercialTerms || {})
            };
            const commercialTermsConfidence = rfpState.commercialTermsConfidence || {};
            
            // Get quantity reasoning for MH backup
            const quantityReasoning = rfpState?.quantityReasoning || {};
            
            // Capture performance chart
            let performanceChartImg = '';
            const chartCanvas = document.getElementById('performance-chart');
            if (chartCanvas && chart) {
                try {
                    performanceChartImg = chartCanvas.toDataURL('image/png');
                } catch (e) {
                    console.error('Could not capture chart:', e);
                }
            }
            
            // Helper function for formatting dates
            const formatDateStr = (dateStr) => {
                if (!dateStr) return 'TBD';
                try {
                    return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
                } catch (e) {
                    return dateStr;
                }
            };
            
            // Helper for commercial term confidence badge
            const getConfidenceBadge = (field) => {
                const level = commercialTermsConfidence[field] || 'low';
                const colors = { high: '#228B22', medium: '#B8860B', low: '#666' };
                return `<span style="font-size: 7pt; color: ${colors[level]}; margin-left: 5px;">[${level}]</span>`;
            };
            
            // Build the report HTML
            let html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Design Fee Book</title>
    <style>
        @media print {
            @page { margin: 0.75in; size: letter; }
            .page-break { page-break-before: always; }
            .no-break { page-break-inside: avoid; }
        }
        
        /* Force professional fonts and BLACK text on all elements */
        * { 
            box-sizing: border-box; 
            margin: 0; 
            padding: 0;
            font-family: Cambria, Georgia, 'Times New Roman', Times, serif !important;
            color: #000 !important;
        }
        
        html, body {
            font-family: Cambria, Georgia, 'Times New Roman', Times, serif !important;
            color: #000 !important;
            background: #fff !important;
            font-size: 10pt;
            line-height: 1.5;
        }
        
        /* Ensure all text elements use professional fonts and BLACK text */
        div, span, p, h1, h2, h3, h4, h5, h6, td, th, li, label, strong, em, b, i {
            font-family: Cambria, Georgia, 'Times New Roman', Times, serif !important;
            color: #000 !important;
        }
        
        table, thead, tbody, tfoot, tr {
            font-family: Cambria, Georgia, 'Times New Roman', Times, serif !important;
            color: #000 !important;
        }
        
        /* Cover Page */
        .cover-page {
            height: 100vh;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            text-align: center;
            border: 3px solid #000;
            padding: 60px;
            font-family: Cambria, Georgia, 'Times New Roman', Times, serif !important;
        }
        .cover-title {
            font-size: 32pt;
            font-weight: bold;
            margin-bottom: 20px;
            text-transform: uppercase;
            letter-spacing: 2px;
            font-family: Cambria, Georgia, 'Times New Roman', Times, serif !important;
            color: #000 !important;
        }
        .cover-subtitle {
            font-size: 14pt;
            margin-bottom: 60px;
            font-style: italic;
            font-family: Cambria, Georgia, 'Times New Roman', Times, serif !important;
            color: #000 !important;
        }
        .cover-metrics {
            display: flex;
            justify-content: center;
            gap: 40px;
            margin: 40px 0;
        }
        .cover-metric {
            text-align: center;
            padding: 20px;
            border: 1px solid #000;
            min-width: 120px;
        }
        .cover-metric-value {
            font-size: 24pt;
            font-weight: bold;
            font-family: Cambria, Georgia, 'Times New Roman', Times, serif !important;
            color: #000 !important;
        }
        .cover-metric-label {
            font-size: 9pt;
            text-transform: uppercase;
            margin-top: 5px;
            font-family: Cambria, Georgia, 'Times New Roman', Times, serif !important;
            color: #000 !important;
        }
        .cover-date {
            position: absolute;
            bottom: 60px;
            font-size: 11pt;
            font-family: Cambria, Georgia, 'Times New Roman', Times, serif !important;
            color: #000 !important;
        }
        
        /* Page Layout */
        .page {
            padding: 40px 50px;
            max-width: 8.5in;
            font-family: Cambria, Georgia, 'Times New Roman', Times, serif !important;
        }
        
        /* Chapter Headers */
        .chapter-header {
            border-bottom: 2px solid #000;
            padding-bottom: 10px;
            margin-bottom: 20px;
        }
        .chapter-number {
            font-size: 11pt;
            font-weight: normal;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 5px;
            font-family: Cambria, Georgia, 'Times New Roman', Times, serif !important;
            color: #000 !important;
        }
        .chapter-title {
            font-size: 18pt;
            font-weight: bold;
            font-family: Cambria, Georgia, 'Times New Roman', Times, serif !important;
            color: #000 !important;
        }
        
        /* Typography */
        h2 {
            font-size: 13pt;
            font-weight: bold;
            margin: 20px 0 10px 0;
            border-bottom: 1px solid #000;
            padding-bottom: 5px;
            font-family: Cambria, Georgia, 'Times New Roman', Times, serif !important;
        }
        h3 {
            font-size: 11pt;
            font-weight: bold;
            margin: 15px 0 8px 0;
            font-family: Cambria, Georgia, 'Times New Roman', Times, serif !important;
        }
        p { 
            margin: 8px 0; 
            line-height: 1.6;
            font-family: Cambria, Georgia, 'Times New Roman', Times, serif !important;
        }
        
        /* KPI Grid */
        .kpi-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
            gap: 15px;
            margin: 15px 0;
        }
        .kpi-card {
            border: 1px solid #000;
            padding: 12px;
            text-align: center;
            font-family: Cambria, Georgia, 'Times New Roman', Times, serif !important;
        }
        .kpi-value {
            font-size: 18pt;
            font-weight: bold;
            font-family: Cambria, Georgia, 'Times New Roman', Times, serif !important;
            color: #000 !important;
        }
        .kpi-label {
            font-size: 8pt;
            text-transform: uppercase;
            margin-top: 3px;
            font-family: Cambria, Georgia, 'Times New Roman', Times, serif !important;
            color: #000 !important;
        }
        
        /* Tables */
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 15px 0;
            font-size: 9pt;
            font-family: Cambria, Georgia, 'Times New Roman', Times, serif !important;
        }
        thead th {
            background: #e5e5e5;
            border: 1px solid #000;
            padding: 8px 6px;
            text-align: left;
            font-weight: bold;
            font-size: 8pt;
            text-transform: uppercase;
            font-family: Cambria, Georgia, 'Times New Roman', Times, serif !important;
            color: #000 !important;
        }
        tbody td {
            border: 1px solid #000;
            padding: 6px;
            font-family: Cambria, Georgia, 'Times New Roman', Times, serif !important;
        }
        tbody tr:nth-child(even) { background: #f5f5f5; }
        tbody tr:nth-child(odd) { background: #fff; }
        tfoot th {
            background: #e5e5e5;
            border: 1px solid #000;
            padding: 8px 6px;
            font-weight: bold;
            font-family: Cambria, Georgia, 'Times New Roman', Times, serif !important;
        }
        .text-right { text-align: right; }
        .text-center { text-align: center; }
        
        /* Info Boxes */
        .info-box {
            border: 1px solid #000;
            padding: 12px 15px;
            margin: 12px 0;
            background: #f9f9f9;
            font-family: Cambria, Georgia, 'Times New Roman', Times, serif !important;
        }
        .info-box h3 { margin-top: 0; font-family: Cambria, Georgia, 'Times New Roman', Times, serif !important; }
        
        /* Risk Cards */
        .risk-item {
            border: 1px solid #000;
            padding: 10px 12px;
            margin: 8px 0;
            font-family: Cambria, Georgia, 'Times New Roman', Times, serif !important;
        }
        .risk-item.severity-high { border-left: 4px solid #000; background: #f5f5f5; }
        .risk-item.severity-medium { border-left: 4px solid #666; }
        .risk-item.severity-low { border-left: 4px solid #999; }
        .risk-header {
            display: flex;
            justify-content: space-between;
            margin-bottom: 5px;
        }
        .risk-category { font-weight: bold; font-family: Cambria, Georgia, 'Times New Roman', Times, serif !important; }
        .risk-severity { 
            font-size: 8pt; 
            text-transform: uppercase;
            border: 1px solid #000;
            padding: 1px 6px;
            font-family: Cambria, Georgia, 'Times New Roman', Times, serif !important;
        }
        .risk-description { font-size: 9pt; margin-bottom: 5px; font-family: Cambria, Georgia, 'Times New Roman', Times, serif !important; }
        .risk-mitigation {
            font-size: 8pt;
            font-style: italic;
            padding: 6px;
            background: #f0f0f0;
            font-family: Cambria, Georgia, 'Times New Roman', Times, serif !important;
        }
        
        /* Insight Cards */
        .insight-item {
            border: 1px solid #000;
            padding: 10px 12px;
            margin: 8px 0;
            display: flex;
            gap: 10px;
            font-family: Cambria, Georgia, 'Times New Roman', Times, serif !important;
        }
        .insight-icon { font-size: 18px; }
        .insight-content { flex: 1; font-family: Cambria, Georgia, 'Times New Roman', Times, serif !important; }
        .insight-title { font-weight: bold; font-size: 10pt; font-family: Cambria, Georgia, 'Times New Roman', Times, serif !important; }
        .insight-desc { font-size: 9pt; margin-top: 3px; font-family: Cambria, Georgia, 'Times New Roman', Times, serif !important; }
        
        /* Discipline Cards */
        .discipline-card {
            border: 1px solid #000;
            padding: 12px;
            margin: 12px 0;
            font-family: Cambria, Georgia, 'Times New Roman', Times, serif !important;
        }
        .discipline-header {
            display: flex;
            justify-content: space-between;
            border-bottom: 1px solid #ccc;
            padding-bottom: 8px;
            margin-bottom: 8px;
        }
        .discipline-name { font-weight: bold; font-size: 11pt; font-family: Cambria, Georgia, 'Times New Roman', Times, serif !important; }
        .discipline-budget { font-weight: bold; font-family: Cambria, Georgia, 'Times New Roman', Times, serif !important; }
        .discipline-scope {
            font-size: 9pt;
            padding: 8px;
            background: #f9f9f9;
            margin-top: 8px;
            font-family: Cambria, Georgia, 'Times New Roman', Times, serif !important;
        }
        
        /* Quantity Backup */
        .quantity-backup {
            font-size: 8pt;
            font-style: italic;
            color: #444;
            padding: 4px 8px;
            background: #f5f5f5;
            margin-top: 2px;
            font-family: Cambria, Georgia, 'Times New Roman', Times, serif !important;
        }
        
        /* Chart */
        .chart-container {
            margin: 20px 0;
            text-align: center;
            font-family: Cambria, Georgia, 'Times New Roman', Times, serif !important;
        }
        .chart-container img {
            max-width: 100%;
            border: 1px solid #000;
        }
        
        /* Footer */
        .page-footer {
            margin-top: 30px;
            padding-top: 10px;
            border-top: 1px solid #000;
            font-size: 8pt;
            text-align: center;
            font-family: Cambria, Georgia, 'Times New Roman', Times, serif !important;
        }
        
        .page-break { page-break-before: always; }
        .no-break { page-break-inside: avoid; }
    </style>
</head>
<body>
    <!-- Cover Page -->
    <div class="cover-page">
        <div class="cover-title">Design Fee Book</div>
        <div class="cover-subtitle">${projectInfo.projectName || 'Project Cost Estimate Documentation'}</div>
        ${projectInfo.projectLocation ? `<div style="font-size: 11pt; margin-bottom: 30px;">${projectInfo.projectLocation}</div>` : ''}
        <div class="cover-metrics">
            <div class="cover-metric">
                <div class="cover-metric-value">${formatCurrency(totalBudget)}</div>
                <div class="cover-metric-label">Total Design Fee</div>
            </div>
            <div class="cover-metric">
                <div class="cover-metric-value">${projectData.disciplines.length}</div>
                <div class="cover-metric-label">Disciplines</div>
            </div>
            <div class="cover-metric">
                <div class="cover-metric-value">${scheduleData.totalMonths || 'TBD'}</div>
                <div class="cover-metric-label">Duration (Months)</div>
            </div>
            <div class="cover-metric">
                <div class="cover-metric-value">${wbsCount}</div>
                <div class="cover-metric-label">WBS Elements</div>
            </div>
        </div>
        <div style="margin-top: 40px; font-size: 9pt;">
            <strong>Purpose:</strong> This Review Document provides a comprehensive review of the design fee and risk evaluations
            to inform the overall project estimate on the design components for inclusion within the final Estimate Review.
        </div>
        <div class="cover-date">${todayFull}</div>
    </div>

    <!-- Chapter 1.0: Project Overview -->
    <div class="page-break"></div>
    <div class="page">
        <div class="chapter-header">
            <div class="chapter-number">Chapter 1.0</div>
            <div class="chapter-title">Project Overview</div>
        </div>
        
        <h2>1.1 Project Information</h2>
        <table>
            <tbody>
                <tr><td style="width: 200px;"><strong>Project Name:</strong></td><td>${projectInfo.projectName || 'TBD'}</td></tr>
                <tr><td><strong>Project Location:</strong></td><td>${projectInfo.projectLocation || 'TBD'}</td></tr>
                <tr><td><strong>Lead District:</strong></td><td>${projectInfo.leadDistrict || 'TBD'}</td></tr>
                <tr><td><strong>Partnering District(s):</strong></td><td>${projectInfo.partneringDistricts || 'N/A'}</td></tr>
                <tr><td><strong>KIE Non-SP Percentage:</strong></td><td>${projectInfo.kieNonSpPercentage ? projectInfo.kieNonSpPercentage + '%' : 'TBD'}</td></tr>
                <tr><td><strong>KEG Entity:</strong></td><td>${projectInfo.kegEntity || 'TBD'}</td></tr>
                <tr><td><strong>Owner Contract Type:</strong></td><td>${projectInfo.ownerContractType || 'TBD'}</td></tr>
            </tbody>
        </table>
        
        <h3>Key Dates</h3>
        <table>
            <tbody>
                <tr><td style="width: 200px;"><strong>Technical Proposal Due:</strong></td><td>${formatDateStr(projectInfo.technicalProposalDue)}</td></tr>
                <tr><td><strong>Price Proposal Due:</strong></td><td>${formatDateStr(projectInfo.priceProposalDue)}</td></tr>
                <tr><td><strong>Interview:</strong></td><td>${formatDateStr(projectInfo.interviewDate)}</td></tr>
                <tr><td><strong>Contract Award:</strong></td><td>${formatDateStr(projectInfo.contractAward)}</td></tr>
                <tr><td><strong>Notice to Proceed:</strong></td><td>${formatDateStr(projectInfo.noticeToProceed)}</td></tr>
                <tr><td><strong>Stipend Amount:</strong></td><td>${projectInfo.stipendAmount ? '$' + projectInfo.stipendAmount : 'N/A'}</td></tr>
            </tbody>
        </table>
        
        ${projectInfo.evaluationCriteria ? `
        <h2>1.2 Owner Evaluation Criteria</h2>
        <div class="info-box">
            <p>${projectInfo.evaluationCriteria.replace(/\n/g, '<br>')}</p>
        </div>
        ` : ''}
        
        ${projectInfo.dbeGoals ? `
        <h2>1.3 DBE / SBE Goals from Prime Contract</h2>
        <div class="info-box">
            <p>${projectInfo.dbeGoals.replace(/\n/g, '<br>')}</p>
        </div>
        ` : ''}
    </div>
`;

            // Chapter 2.0: Commercial Status
            html += `
    <div class="page-break"></div>
    <div class="page">
        <div class="chapter-header">
            <div class="chapter-number">Chapter 2.0</div>
            <div class="chapter-title">Commercial Status</div>
        </div>
        
        <h2>2.1 Owner Commercial Key Terms Comparison</h2>
        <table>
            <tbody>
                <tr><td style="width: 220px;"><strong>Project Name:</strong></td><td>${projectInfo.projectName || 'TBD'}</td></tr>
                <tr><td><strong>Client:</strong></td><td>${commercialTerms.client || 'TBD'}${getConfidenceBadge('client')}</td></tr>
                <tr><td><strong>Project Value:</strong></td><td>${commercialTerms.projectValue || (rfpData.projectInfo?.projectCostM ? '$' + rfpData.projectInfo.projectCostM + 'M' : 'TBD')}</td></tr>
                <tr><td><strong>Project Status:</strong></td><td>${commercialTerms.projectStatus || 'Pursuit'}</td></tr>
            </tbody>
        </table>
        
        <h3>Contract Terms</h3>
        <table>
            <tbody>
                <tr><td style="width: 220px;"><strong>Waiver of Consequential Damages:</strong></td><td>${commercialTerms.waiverConsequentialDamages || 'Not specified'}${getConfidenceBadge('waiverConsequentialDamages')}</td></tr>
                <tr><td><strong>Limitation of Liability:</strong></td><td>${commercialTerms.limitationOfLiability || 'Not specified'}${getConfidenceBadge('limitationOfLiability')}</td></tr>
                <tr><td><strong>Professional Liability:</strong></td><td>${commercialTerms.professionalLiability || 'Not specified'}${getConfidenceBadge('professionalLiability')}</td></tr>
                <tr><td><strong>Insurance Requirements:</strong></td><td>${commercialTerms.insuranceRequirements || 'Not specified'}${getConfidenceBadge('insuranceRequirements')}</td></tr>
                <tr><td><strong>Standard of Care:</strong></td><td>${commercialTerms.standardOfCare || 'Not specified'}${getConfidenceBadge('standardOfCare')}</td></tr>
                <tr><td><strong>Relied Upon Information:</strong></td><td>${commercialTerms.reliedUponInformation || 'Not specified'}${getConfidenceBadge('reliedUponInformation')}</td></tr>
                <tr><td><strong>3rd Party Delays & Impacts:</strong></td><td>${commercialTerms.thirdPartyDelays || 'Not specified'}${getConfidenceBadge('thirdPartyDelays')}</td></tr>
                <tr><td><strong>Impacts by 3rd Party Contractors:</strong></td><td>${commercialTerms.thirdPartyContractorImpacts || 'Not specified'}${getConfidenceBadge('thirdPartyContractorImpacts')}</td></tr>
                <tr><td><strong>Indemnification:</strong></td><td>${commercialTerms.indemnification || 'Not specified'}${getConfidenceBadge('indemnification')}</td></tr>
            </tbody>
        </table>
        
        <h2>2.2 Design Subcontract Tracking</h2>
        <div class="info-box">
            <p><em>To be developed during contract negotiation phase.</em></p>
        </div>
    </div>
`;

            // Chapter 3.0: Team Organization and Scope
            const scope = rfpData.hasRfpData ? rfpData.scope : projectData.projectScope;
            html += `
    <div class="page-break"></div>
    <div class="page">
        <div class="chapter-header">
            <div class="chapter-number">Chapter 3.0</div>
            <div class="chapter-title">Team Organization and Scope</div>
        </div>
        
        <h2>3.1 Design Scope of Work</h2>
        ${scope ? `
        <div class="info-box">
            <p>${scope.replace(/\n/g, '<br>')}</p>
        </div>
        ` : `
        <div class="info-box">
            <p><em>Design scope to be extracted from RFP or entered manually.</em></p>
        </div>
        `}
        
        <h3>Project Phases</h3>
        <table>
            <tbody>
                ${projectData.phases.map((p, i) => `<tr><td style="width: 40px;">${i+1}.</td><td>${p}</td></tr>`).join('')}
            </tbody>
        </table>
        
        <h3>Deliverable Packages</h3>
        <table>
            <tbody>
                ${projectData.packages.map((p, i) => `<tr><td style="width: 40px;">${i+1}.</td><td>${p}</td></tr>`).join('')}
            </tbody>
        </table>
        
        <h2>3.2 Project Organization</h2>
        ${projectData.projectOrganization ? `
        <div class="info-box">
            <p>${projectData.projectOrganization.replace(/\n/g, '<br>')}</p>
        </div>
        ` : `
        <div class="info-box">
            <p><em>Project organization to be defined in Step 7 of the wizard.</em></p>
        </div>
        `}
    </div>
`;

            // Chapter 4.0: Schedule
            html += `
    <div class="page-break"></div>
    <div class="page">
        <div class="chapter-header">
            <div class="chapter-number">Chapter 4.0</div>
            <div class="chapter-title">Schedule</div>
        </div>
        
        <h2>4.1 Summary Level Design Package Schedule</h2>
        <div class="kpi-grid no-break">
            <div class="kpi-card">
                <div class="kpi-value">${scheduleData.totalMonths || (rfpData.projectInfo?.designDurationMonths || 'TBD')}</div>
                <div class="kpi-label">Total Months</div>
            </div>
            <div class="kpi-card">
                <div class="kpi-value">${scheduleData.startDate || 'TBD'}</div>
                <div class="kpi-label">Start Date</div>
            </div>
            <div class="kpi-card">
                <div class="kpi-value">${scheduleData.endDate || 'TBD'}</div>
                <div class="kpi-label">End Date</div>
            </div>
            <div class="kpi-card">
                <div class="kpi-value">${scheduleData.totalDays || 'TBD'}</div>
                <div class="kpi-label">Total Days</div>
            </div>
        </div>
`;

            // Schedule notes/rationale
            const scheduleNotes = projectData.scheduleNotes || rfpData.schedule;
            if (scheduleNotes) {
                html += `
        <div class="info-box">
            <h3>AI Schedule Rationale</h3>
            <p>${scheduleNotes.replace(/\n/g, '<br>')}</p>
        </div>
`;
            }

            // Schedule by package table
            html += `
        <h2>4.2 Typical Fragnet by Package</h2>
        <table>
            <thead>
                <tr>
                    <th>Discipline</th>
                    <th>Package</th>
                    <th class="text-center">Claim %</th>
                    <th>Start</th>
                    <th>End</th>
                </tr>
            </thead>
            <tbody>
`;
            projectData.disciplines.forEach(disc => {
                projectData.packages.forEach((pkg, idx) => {
                    const key = `${disc}-${pkg}`;
                    const claimPct = projectData.claiming[key] || 0;
                    const dates = projectData.dates[key] || { start: '—', end: '—' };
                    html += `
                <tr>
                    ${idx === 0 ? `<td rowspan="${projectData.packages.length}"><strong>${disc}</strong></td>` : ''}
                    <td>${pkg}</td>
                    <td class="text-center">${claimPct}%</td>
                    <td>${dates.start || '—'}</td>
                    <td>${dates.end || '—'}</td>
                </tr>`;
                });
            });
            html += `
            </tbody>
        </table>
`;

            // Performance chart if available
            if (performanceChartImg) {
                html += `
        <div class="chart-container no-break">
            <h3>Cost Performance Chart</h3>
            <img src="${performanceChartImg}" alt="Performance Chart" style="max-width: 100%;">
        </div>
`;
            }
            html += `
    </div>
`;

            // Chapter 5.0: Design Fee Estimate - if RFP data available, show RFP analysis first
            if (rfpData.hasRfpData) {
                html += `
    <div class="page-break"></div>
    <div class="page">
        <div class="chapter-header">
            <div class="chapter-number">Chapter 5.0</div>
            <div class="chapter-title">Design Fee Estimate</div>
        </div>
        
        <div class="kpi-grid no-break">
            ${rfpData.projectInfo.projectCostM ? `
            <div class="kpi-card">
                <div class="kpi-value">$${rfpData.projectInfo.projectCostM}M</div>
                <div class="kpi-label">Est. Construction Cost</div>
            </div>` : ''}
            <div class="kpi-card">
                <div class="kpi-value">${formatCurrency(totalBudget)}</div>
                <div class="kpi-label">Total Design Fee</div>
            </div>
            ${rfpData.projectInfo.projectType ? `
            <div class="kpi-card">
                <div class="kpi-value" style="font-size: 12pt;">${rfpData.projectInfo.projectType}</div>
                <div class="kpi-label">Project Type</div>
            </div>` : ''}
            ${rfpData.projectInfo.complexity ? `
            <div class="kpi-card">
                <div class="kpi-value">${rfpData.projectInfo.complexity}</div>
                <div class="kpi-label">Complexity</div>
            </div>` : ''}
        </div>
`;
                // AI Cost Reasoning
                if (rfpData.projectInfoReasoning?.projectCostReasoning) {
                    html += `
        <div class="info-box no-break">
            <h3>AI Cost Estimate Reasoning</h3>
            <p style="font-size: 9pt;">${rfpData.projectInfoReasoning.projectCostReasoning}</p>
        </div>
`;
                }

                // Key Quantities
                if (rfpData.quantities.length > 0) {
                    html += `
        <h2>Key Engineering Quantities</h2>
        <table>
            <thead>
                <tr>
                    <th>Quantity</th>
                    <th class="text-right">Value</th>
                    <th>Unit</th>
                    <th>Source/Reasoning</th>
                </tr>
            </thead>
            <tbody>
`;
                    rfpData.quantities.forEach(qty => {
                        html += `
                <tr>
                    <td>${qty.label}</td>
                    <td class="text-right">${formatNumber(qty.value)}</td>
                    <td>${qty.unit}</td>
                    <td style="font-size: 8pt; font-style: italic;">${qty.reasoning || 'From RFP'}</td>
                </tr>`;
                    });
                    html += `
            </tbody>
        </table>
`;
                }

                // Confidence Scores
                if (Object.keys(rfpData.confidence).length > 0) {
                    html += `
        <h2>AI Extraction Confidence</h2>
        <table>
            <thead>
                <tr><th>Category</th><th class="text-center">Confidence Level</th></tr>
            </thead>
            <tbody>
`;
                    Object.entries(rfpData.confidence).forEach(([key, value]) => {
                        html += `
                <tr>
                    <td>${key.charAt(0).toUpperCase() + key.slice(1)}</td>
                    <td class="text-center">${value}</td>
                </tr>`;
                    });
                    html += `
            </tbody>
        </table>
    </div>
`;
                }
            }

            // Continue Chapter 5: Cost Estimate Details (section 5.2)
            html += `
        <h2>5.2 WBS Breakdown with Cost and Hours</h2>
        
        <h3>Discipline Budget Allocation</h3>
        <table>
            <thead>
                <tr>
                    <th>Discipline</th>
                    <th class="text-center">Complexity</th>
                    <th class="text-right">Industry %</th>
                    <th class="text-right">Actual %</th>
                    <th class="text-right">Budget</th>
                </tr>
            </thead>
            <tbody>
`;
            assumptions.disciplines.forEach(disc => {
                html += `
                <tr>
                    <td><strong>${disc.name}</strong></td>
                    <td class="text-center">${disc.complexity}</td>
                    <td class="text-right">${disc.industryBasePct}%</td>
                    <td class="text-right">${disc.percentOfTotal}%</td>
                    <td class="text-right"><strong>${formatCurrency(disc.budget)}</strong></td>
                </tr>`;
            });
            html += `
            </tbody>
            <tfoot>
                <tr>
                    <th colspan="4">Total Design Fee</th>
                    <th class="text-right">${formatCurrency(totalBudget)}</th>
                </tr>
            </tfoot>
        </table>
    </div>
`;

            // Section 5.1: MH Benchmark Analysis (if available)
            if (mhData.hasMHData) {
                html += `
    <div class="page-break"></div>
    <div class="page">
        <div class="chapter-header">
            <div class="chapter-number">Section 5.1</div>
            <div class="chapter-title">MH Benchmarking</div>
        </div>
        
        <div class="kpi-grid no-break">
            <div class="kpi-card">
                <div class="kpi-value">${formatMH(mhData.totalMH)}</div>
                <div class="kpi-label">Total Man-Hours</div>
            </div>
            <div class="kpi-card">
                <div class="kpi-value">${formatCurrency(mhData.totalBudget)}</div>
                <div class="kpi-label">Est. Budget @ $${mhData.hourlyRate}/hr</div>
            </div>
            <div class="kpi-card">
                <div class="kpi-value">${mhData.disciplines.length}</div>
                <div class="kpi-label">Disciplines</div>
            </div>
            <div class="kpi-card">
                <div class="kpi-value">${mhData.complexity}</div>
                <div class="kpi-label">Complexity</div>
            </div>
        </div>
        
        <h2>Discipline Man-Hour Breakdown</h2>
        <table>
            <thead>
                <tr>
                    <th>Discipline</th>
                    <th class="text-right">Quantity</th>
                    <th class="text-right">Rate (MH/unit)</th>
                    <th class="text-right">Man-Hours</th>
                    <th class="text-right">Budget</th>
                </tr>
            </thead>
            <tbody>
`;
                mhData.disciplines.forEach(disc => {
                    const reasoning = quantityReasoning[disc.id] || '';
                    html += `
                <tr>
                    <td>
                        <strong>${disc.name}</strong>
                        ${reasoning ? `<div class="quantity-backup">Source: ${reasoning}</div>` : ''}
                    </td>
                    <td class="text-right">${formatNumber(disc.quantity)}</td>
                    <td class="text-right">${disc.rate.toFixed(2)}</td>
                    <td class="text-right">${formatMH(disc.mh)}</td>
                    <td class="text-right">${formatCurrency(disc.budget)}</td>
                </tr>`;
                });
                html += `
            </tbody>
            <tfoot>
                <tr>
                    <th colspan="3">Total</th>
                    <th class="text-right">${formatMH(mhData.totalMH)}</th>
                    <th class="text-right">${formatCurrency(mhData.totalBudget)}</th>
                </tr>
            </tfoot>
        </table>
        
        <div class="info-box">
            <p><strong>Note:</strong> Man-hour estimates based on historical benchmark data. Budget calculated using $${mhData.hourlyRate}/hour blended rate.</p>
        </div>
    </div>
`;
            }

            // Section 5.3: Discipline Cost Details (Cost Curves)
            html += `
    <div class="page-break"></div>
    <div class="page">
        <div class="chapter-header">
            <div class="chapter-number">Section 5.3</div>
            <div class="chapter-title">Cost Curves - Discipline Details</div>
        </div>
`;
            projectData.disciplines.forEach(disc => {
                const budget = projectData.budgets[disc] || 0;
                const pct = totalBudget > 0 ? ((budget / totalBudget) * 100).toFixed(1) : 0;
                const scope = projectData.disciplineScopes?.[disc] || '';
                
                html += `
        <div class="discipline-card no-break">
            <div class="discipline-header">
                <span class="discipline-name">${disc}</span>
                <span class="discipline-budget">${formatCurrency(budget)} (${pct}%)</span>
            </div>
`;
                if (scope) {
                    html += `<div class="discipline-scope">${scope.replace(/\n/g, '<br>')}</div>`;
                }
                
                html += `
            <table style="margin-top: 10px; font-size: 8pt;">
                <thead>
                    <tr>
                        <th>Package</th>
                        <th class="text-center">Claim %</th>
                        <th class="text-right">Budget</th>
                        <th>Start</th>
                        <th>End</th>
                    </tr>
                </thead>
                <tbody>
`;
                projectData.packages.forEach(pkg => {
                    const key = `${disc}-${pkg}`;
                    const claimPct = projectData.claiming[key] || 0;
                    const pkgBudget = budget * (claimPct / 100);
                    const dates = projectData.dates[key] || {};
                    
                    html += `
                    <tr>
                        <td>${pkg}</td>
                        <td class="text-center">${claimPct}%</td>
                        <td class="text-right">${formatCurrency(pkgBudget)}</td>
                        <td>${dates.start || '—'}</td>
                        <td>${dates.end || '—'}</td>
                    </tr>`;
                });
                html += `
                </tbody>
            </table>
        </div>
`;
            });
            html += `
    </div>
`;

            // Chapter 6.0: Resource Evaluation (placeholder for future)
            html += `
    <div class="page-break"></div>
    <div class="page">
        <div class="chapter-header">
            <div class="chapter-number">Chapter 6.0</div>
            <div class="chapter-title">Resource Evaluation</div>
        </div>
        
        <h2>6.1 Design FTE's by Discipline</h2>
        <div class="info-box">
            <p><em>Resource evaluation and FTE planning to be developed in future versions.</em></p>
        </div>
    </div>
`;

            // Chapter 6 (legacy Schedule Analysis - keep if schedule data available)
            if (scheduleData.hasSchedule && false) { // Disabled - schedule is now in Chapter 4
                html += `
    <div class="page-break"></div>
    <div class="page">
        <div class="chapter-header">
            <div class="chapter-number">Appendix A</div>
            <div class="chapter-title">Schedule Analysis</div>
        </div>
        
        <div class="kpi-grid no-break">
            <div class="kpi-card">
                <div class="kpi-value">${scheduleData.totalMonths}</div>
                <div class="kpi-label">Total Months</div>
            </div>
            <div class="kpi-card">
                <div class="kpi-value">${scheduleData.startDate || 'TBD'}</div>
                <div class="kpi-label">Start Date</div>
            </div>
            <div class="kpi-card">
                <div class="kpi-value">${scheduleData.endDate || 'TBD'}</div>
                <div class="kpi-label">End Date</div>
            </div>
            <div class="kpi-card">
                <div class="kpi-value">${scheduleData.totalDays}</div>
                <div class="kpi-label">Total Days</div>
            </div>
        </div>
`;
                if (scheduleData.aiScheduleRationale) {
                    html += `
        <div class="info-box no-break">
            <h3>AI Schedule Rationale</h3>
            <p style="font-size: 9pt;">${scheduleData.aiScheduleRationale}</p>
        </div>
`;
                }
                if (scheduleData.scheduleNotes) {
                    html += `
        <div class="info-box no-break">
            <h3>Schedule Notes</h3>
            <p>${scheduleData.scheduleNotes.replace(/\n/g, '<br>')}</p>
        </div>
`;
                }
                if (performanceChartImg) {
                    html += `
        <div class="chart-container no-break">
            <h3>Budget Distribution Over Time</h3>
            <img src="${performanceChartImg}" alt="Performance Chart" />
        </div>
`;
                }
                html += `
    </div>
`;
            }

            // Chapter 7.0: Risk Review
            const highRisks = (rfpData.hasRfpData && rfpData.risks) ? rfpData.risks.filter(r => (r.severity || '').toLowerCase() === 'high').length : 0;
            const mediumRisks = (rfpData.hasRfpData && rfpData.risks) ? rfpData.risks.filter(r => (r.severity || '').toLowerCase() === 'medium').length : 0;
            const lowRisks = (rfpData.hasRfpData && rfpData.risks) ? rfpData.risks.filter(r => !r.severity || (r.severity || '').toLowerCase() === 'low').length : 0;
            const totalRisks = highRisks + mediumRisks + lowRisks;
            
            html += `
    <div class="page-break"></div>
    <div class="page">
        <div class="chapter-header">
            <div class="chapter-number">Chapter 7.0</div>
            <div class="chapter-title">Risk Review</div>
        </div>
        
        <h2>7.1 Design Risk Register</h2>
        
        <div class="kpi-grid no-break">
            <div class="kpi-card">
                <div class="kpi-value">${highRisks}</div>
                <div class="kpi-label">High Severity</div>
            </div>
            <div class="kpi-card">
                <div class="kpi-value">${mediumRisks}</div>
                <div class="kpi-label">Medium Severity</div>
            </div>
            <div class="kpi-card">
                <div class="kpi-value">${lowRisks}</div>
                <div class="kpi-label">Low Severity</div>
            </div>
        </div>
`;
            
            if (rfpData.hasRfpData && rfpData.risks && rfpData.risks.length > 0) {
                const severityOrder = { high: 0, medium: 1, low: 2 };
                const sortedRisks = [...rfpData.risks].sort((a, b) => {
                    return (severityOrder[(a.severity || 'low').toLowerCase()] || 2) - 
                           (severityOrder[(b.severity || 'low').toLowerCase()] || 2);
                });
                
                sortedRisks.forEach((risk, idx) => {
                    const severity = (risk.severity || 'Medium').toLowerCase();
                    const category = risk.category || 'General';
                    const description = typeof risk === 'string' ? risk : (risk.description || '');
                    const mitigation = risk.mitigation || '';
                    
                    html += `
        <div class="risk-item severity-${severity} no-break">
            <div class="risk-header">
                <span class="risk-category">${idx + 1}. ${category}</span>
                <span class="risk-severity">${severity.toUpperCase()}</span>
            </div>
            <div class="risk-description">${description}</div>
            ${mitigation ? `<div class="risk-mitigation">Mitigation: ${mitigation}</div>` : ''}
        </div>
`;
                });
            } else {
                html += `
        <div class="info-box">
            <p><em>No risks have been identified yet. Run the RFP Wizard to extract risk information from the RFP document.</em></p>
        </div>
`;
            }
            
            html += `
    </div>
`;

            // Appendix A: AI Insights (if available)
            if (aiInsights.hasInsights) {
                html += `
    <div class="page-break"></div>
    <div class="page">
        <div class="chapter-header">
            <div class="chapter-number">Appendix A</div>
            <div class="chapter-title">AI Insights & Recommendations</div>
        </div>
        
        <p>The following optimization suggestions were generated by AI analysis of the project data:</p>
`;
                aiInsights.suggestions.forEach(insight => {
                    html += `
        <div class="insight-item no-break">
            <div class="insight-icon">${insight.icon}</div>
            <div class="insight-content">
                <div class="insight-title">${insight.title}</div>
                <div class="insight-desc">${insight.description}</div>
            </div>
        </div>
`;
                });
                html += `
    </div>
`;
            }

            // Appendix B: Complete WBS Table
            html += `
    <div class="page-break"></div>
    <div class="page">
        <div class="chapter-header">
            <div class="chapter-number">Appendix B</div>
            <div class="chapter-title">Complete Work Breakdown Structure</div>
        </div>
        
        <p style="margin-bottom: 15px;">${wbsCount} WBS Elements: ${projectData.phases.length} Phases × ${projectData.disciplines.length} Disciplines × ${projectData.packages.length} Packages</p>
        
        <table>
            <thead>
                <tr>
                    <th style="width: 50px;">WBS #</th>
                    <th>Phase</th>
                    <th>Discipline</th>
                    <th>Package</th>
                    <th class="text-right" style="width: 80px;">Budget</th>
                    <th class="text-center" style="width: 50px;">Claim %</th>
                    <th style="width: 75px;">Start</th>
                    <th style="width: 75px;">End</th>
                </tr>
            </thead>
            <tbody>
`;
            let grandTotal = 0;
            projectData.phases.forEach((phase, pi) => {
                projectData.disciplines.forEach((discipline, di) => {
                    const discBudget = projectData.budgets[discipline] || 0;
                    projectData.packages.forEach((packageName, ki) => {
                        const key = `${discipline}-${packageName}`;
                        const claimPct = projectData.claiming[key] || 0;
                        const pkgBudget = discBudget * (claimPct / 100);
                        const dates = projectData.dates[key] || { start: '—', end: '—' };
                        const wbs = `${pi+1}.${di+1}.${ki+1}`;
                        grandTotal += pkgBudget;
                        
                        html += `
                <tr>
                    <td><strong>${wbs}</strong></td>
                    <td>${phase}</td>
                    <td>${discipline}</td>
                    <td>${packageName}</td>
                    <td class="text-right">${formatCurrency(pkgBudget)}</td>
                    <td class="text-center">${claimPct}%</td>
                    <td>${dates.start || '—'}</td>
                    <td>${dates.end || '—'}</td>
                </tr>`;
                    });
                });
            });
            
            html += `
            </tbody>
            <tfoot>
                <tr>
                    <th colspan="4">Grand Total</th>
                    <th class="text-right">${formatCurrency(grandTotal)}</th>
                    <th colspan="3"></th>
                </tr>
            </tfoot>
        </table>
        
        <div class="page-footer">
            <strong>Design Fee Book</strong> — Generated ${todayFull}
        </div>
    </div>
</body>
</html>`;

            // Generate PDF
            const container = document.createElement('div');
            container.innerHTML = html;
            document.body.appendChild(container);
            
            const filename = `design_fee_book_${new Date().toISOString().split('T')[0]}.pdf`;
            const opt = {
                margin: [0.5, 0.5, 0.5, 0.5],
                filename: filename,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { 
                    scale: 2, 
                    useCORS: true,
                    letterRendering: true,
                    willReadFrequently: true
                },
                jsPDF: { 
                    unit: 'in', 
                    format: 'letter', 
                    orientation: 'portrait' 
                },
                pagebreak: { mode: ['css', 'legacy'] }
            };
            
            html2pdf().set(opt).from(container).outputPdf('blob').then(blob => {
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                document.body.removeChild(container);
            }).catch(err => {
                console.error('PDF generation failed:', err);
                document.body.removeChild(container);
                alert('PDF generation failed. Please try again.');
            });
        }

        // ============================================
        // RFP RESULTS PANEL
        // ============================================

        /**
         * Opens the RFP Results panel and populates it with extracted data
         */
        function openRfpResultsPanel() {
            const modal = document.getElementById('rfp-results-modal');
            if (!modal) return;
            
            modal.classList.add('open');
            populateRfpResultsPanel();
        }

        /**
         * Closes the RFP Results panel
         */
        function closeRfpResultsPanel() {
            const modal = document.getElementById('rfp-results-modal');
            if (modal) {
                modal.classList.remove('open');
            }
        }

        /**
         * Toggles a section in the RFP Results panel
         */
        function toggleRfpResultSection(sectionId) {
            const section = document.getElementById(`rfp-result-${sectionId}`)?.closest('.rfp-result-section');
            if (section) {
                section.classList.toggle('collapsed');
            }
        }

        /**
         * Populates the RFP Results panel with extracted data
         */
        function populateRfpResultsPanel() {
            const emptyState = document.getElementById('rfp-results-empty');
            const contentState = document.getElementById('rfp-results-content');
            
            // Check if we have RFP data
            const hasData = rfpState && rfpState.extractedData && 
                (rfpState.extractedData.scope || 
                 rfpState.extractedData.disciplines?.length > 0 ||
                 Object.values(rfpState.quantities || {}).some(v => v > 0));
            
            if (!hasData) {
                emptyState?.classList.remove('hidden');
                contentState?.classList.add('hidden');
                return;
            }
            
            emptyState?.classList.add('hidden');
            contentState?.classList.remove('hidden');
            
            const data = rfpState.extractedData || {};
            const quantities = rfpState.quantities || {};
            const projectInfo = rfpState.projectInfo || {};
            const quantityReasoning = rfpState.quantityReasoning || {};
            
            // Populate KPIs
            const kpisContainer = document.getElementById('rfp-result-kpis');
            if (kpisContainer) {
                const disciplines = data.disciplines || [];
                const phases = data.phases || [];
                const packages = data.packages || [];
                const risks = data.risks || [];
                const activeQuantities = Object.entries(quantities).filter(([k, v]) => v > 0).length;
                
                kpisContainer.innerHTML = `
                    ${projectInfo.projectCostM ? `
                    <div class="rfp-result-kpi highlight">
                        <div class="rfp-result-kpi-value">$${projectInfo.projectCostM}M</div>
                        <div class="rfp-result-kpi-label">Est. Project Cost</div>
                    </div>` : ''}
                    ${projectInfo.designDurationMonths ? `
                    <div class="rfp-result-kpi">
                        <div class="rfp-result-kpi-value">${projectInfo.designDurationMonths}</div>
                        <div class="rfp-result-kpi-label">Design Months</div>
                    </div>` : ''}
                    <div class="rfp-result-kpi">
                        <div class="rfp-result-kpi-value">${disciplines.length}</div>
                        <div class="rfp-result-kpi-label">Disciplines</div>
                    </div>
                    <div class="rfp-result-kpi">
                        <div class="rfp-result-kpi-value">${phases.length}</div>
                        <div class="rfp-result-kpi-label">Phases</div>
                    </div>
                    <div class="rfp-result-kpi">
                        <div class="rfp-result-kpi-value">${packages.length}</div>
                        <div class="rfp-result-kpi-label">Packages</div>
                    </div>
                    <div class="rfp-result-kpi">
                        <div class="rfp-result-kpi-value">${activeQuantities}</div>
                        <div class="rfp-result-kpi-label">Quantities</div>
                    </div>
                    <div class="rfp-result-kpi">
                        <div class="rfp-result-kpi-value">${risks.length}</div>
                        <div class="rfp-result-kpi-label">Risks</div>
                    </div>
                `;
            }
            
            // Populate Scope
            const scopeContainer = document.getElementById('rfp-result-scope-text');
            if (scopeContainer) {
                const scope = data.scope || projectData.projectScope || '';
                scopeContainer.textContent = scope || 'No scope information extracted.';
                scopeContainer.classList.toggle('empty', !scope);
            }
            
            // Populate Quantities
            const quantitiesContainer = document.getElementById('rfp-result-quantities-grid');
            if (quantitiesContainer) {
                const quantityLabels = {
                    roadwayLengthLF: { label: 'Roadway Length', unit: 'LF' },
                    projectAreaAC: { label: 'Project Area', unit: 'AC' },
                    wallAreaSF: { label: 'Retaining Wall Area', unit: 'SF' },
                    noiseWallAreaSF: { label: 'Noise Wall Area', unit: 'SF' },
                    bridgeDeckAreaSF: { label: 'Bridge Deck Area', unit: 'SF' },
                    bridgeCount: { label: 'Number of Bridges', unit: '' },
                    structureCount: { label: 'Number of Structures', unit: '' },
                    utilityRelocations: { label: 'Utility Relocations', unit: '' },
                    permitCount: { label: 'Permits Required', unit: '' },
                    trackLengthTF: { label: 'Track Length', unit: 'TF' }
                };
                
                const activeQuantities = Object.entries(quantities).filter(([k, v]) => v > 0);
                
                if (activeQuantities.length > 0) {
                    quantitiesContainer.innerHTML = activeQuantities.map(([key, value]) => {
                        const info = quantityLabels[key] || { label: key, unit: '' };
                        const reasoning = quantityReasoning[key] || '';
                        return `
                            <div class="rfp-result-quantity has-value">
                                <div class="rfp-result-quantity-label">${info.label}</div>
                                <div class="rfp-result-quantity-value">${formatNumber(value)}<span class="rfp-result-quantity-unit">${info.unit}</span></div>
                                ${reasoning ? `<div class="rfp-result-quantity-reasoning">${reasoning}</div>` : ''}
                            </div>
                        `;
                    }).join('');
                } else {
                    quantitiesContainer.innerHTML = '<div class="rfp-result-text empty">No quantities extracted.</div>';
                }
            }
            
            // Populate Schedule
            const scheduleContainer = document.getElementById('rfp-result-schedule-text');
            if (scheduleContainer) {
                const schedule = data.schedule || projectData.scheduleNotes || '';
                scheduleContainer.textContent = schedule || 'No schedule information extracted.';
                scheduleContainer.classList.toggle('empty', !schedule);
            }
            
            // Populate Disciplines
            const disciplinesContainer = document.getElementById('rfp-result-disciplines-list');
            if (disciplinesContainer) {
                const disciplines = data.disciplines || [];
                const scopes = data.disciplineScopes || projectData.disciplineScopes || {};
                
                if (disciplines.length > 0) {
                    disciplinesContainer.innerHTML = disciplines.map(disc => {
                        const scope = scopes[disc] || '';
                        return `
                            <div class="rfp-result-discipline">
                                <div class="rfp-result-discipline-name">📌 ${disc}</div>
                                <div class="rfp-result-discipline-scope ${!scope ? 'empty' : ''}">${scope || 'No specific scope extracted.'}</div>
                            </div>
                        `;
                    }).join('');
                } else {
                    disciplinesContainer.innerHTML = '<div class="rfp-result-text empty">No disciplines extracted.</div>';
                }
            }
            
            // Populate Risks
            const risksContainer = document.getElementById('rfp-result-risks-list');
            if (risksContainer) {
                const risks = data.risks || [];
                
                if (risks.length > 0) {
                    // Sort by severity
                    const severityOrder = { high: 0, medium: 1, low: 2 };
                    const sortedRisks = [...risks].sort((a, b) => {
                        const aSev = (a.severity || 'low').toLowerCase();
                        const bSev = (b.severity || 'low').toLowerCase();
                        return (severityOrder[aSev] || 2) - (severityOrder[bSev] || 2);
                    });
                    
                    risksContainer.innerHTML = sortedRisks.map(risk => {
                        const severity = (risk.severity || 'medium').toLowerCase();
                        const category = risk.category || 'General';
                        const description = typeof risk === 'string' ? risk : (risk.description || '');
                        const mitigation = risk.mitigation || '';
                        return `
                            <div class="rfp-result-risk severity-${severity}">
                                <div class="rfp-result-risk-header">
                                    <span class="rfp-result-risk-category">${category}</span>
                                    <span class="rfp-result-risk-severity ${severity}">${severity}</span>
                                </div>
                                <div class="rfp-result-risk-description">${description}</div>
                                ${mitigation ? `<div class="rfp-result-risk-mitigation">${mitigation}</div>` : ''}
                            </div>
                        `;
                    }).join('');
                } else {
                    risksContainer.innerHTML = '<div class="rfp-result-text empty">No risks identified.</div>';
                }
            }
            
            // Populate Project Info / Key Dates
            const projectInfoContainer = document.getElementById('rfp-result-project-info');
            if (projectInfoContainer) {
                const pInfo = rfpState.projectInfo || data.projectInfo || {};
                const hasProjectInfo = pInfo.projectName || pInfo.projectLocation || pInfo.technicalProposalDue || 
                                       pInfo.priceProposalDue || pInfo.ownerContractType;
                
                if (hasProjectInfo) {
                    projectInfoContainer.innerHTML = `
                        <div class="rfp-result-info-grid">
                            ${pInfo.projectName ? `<div class="rfp-result-info-item"><span class="label">Project Name:</span> ${pInfo.projectName}</div>` : ''}
                            ${pInfo.projectLocation ? `<div class="rfp-result-info-item"><span class="label">Location:</span> ${pInfo.projectLocation}</div>` : ''}
                            ${pInfo.ownerContractType ? `<div class="rfp-result-info-item"><span class="label">Contract Type:</span> ${pInfo.ownerContractType}</div>` : ''}
                            ${pInfo.technicalProposalDue ? `<div class="rfp-result-info-item"><span class="label">Tech Proposal Due:</span> ${pInfo.technicalProposalDue}</div>` : ''}
                            ${pInfo.priceProposalDue ? `<div class="rfp-result-info-item"><span class="label">Price Proposal Due:</span> ${pInfo.priceProposalDue}</div>` : ''}
                            ${pInfo.interviewDate ? `<div class="rfp-result-info-item"><span class="label">Interview:</span> ${pInfo.interviewDate}</div>` : ''}
                            ${pInfo.contractAward ? `<div class="rfp-result-info-item"><span class="label">Contract Award:</span> ${pInfo.contractAward}</div>` : ''}
                            ${pInfo.noticeToProceed ? `<div class="rfp-result-info-item"><span class="label">NTP:</span> ${pInfo.noticeToProceed}</div>` : ''}
                            ${pInfo.stipendAmount ? `<div class="rfp-result-info-item"><span class="label">Stipend:</span> ${pInfo.stipendAmount}</div>` : ''}
                        </div>
                        ${pInfo.evaluationCriteria ? `<div class="rfp-result-info-section"><strong>Evaluation Criteria:</strong><br>${pInfo.evaluationCriteria}</div>` : ''}
                        ${pInfo.dbeGoals ? `<div class="rfp-result-info-section"><strong>DBE/SBE Goals:</strong> ${pInfo.dbeGoals}</div>` : ''}
                    `;
                } else {
                    projectInfoContainer.innerHTML = '<div class="rfp-result-text empty">No project info extracted.</div>';
                }
            }
            
            // Populate Commercial Terms
            const commercialContainer = document.getElementById('rfp-result-commercial-terms');
            if (commercialContainer) {
                const terms = rfpState.commercialTerms || data.commercialTerms || {};
                const confidence = rfpState.commercialTermsConfidence || data.commercialTermsConfidence || {};
                const hasTerms = Object.values(terms).some(v => v && v !== 'Not specified');
                
                const getConfBadge = (field) => {
                    const level = confidence[field] || 'low';
                    return `<span class="rfp-confidence-badge ${level}">${level}</span>`;
                };
                
                if (hasTerms) {
                    commercialContainer.innerHTML = `
                        <div class="rfp-result-commercial-grid">
                            ${terms.client ? `<div class="rfp-result-commercial-item"><span class="label">Client:</span> ${terms.client} ${getConfBadge('client')}</div>` : ''}
                            ${terms.waiverConsequentialDamages ? `<div class="rfp-result-commercial-item"><span class="label">Waiver of Consequential Damages:</span> ${terms.waiverConsequentialDamages} ${getConfBadge('waiverConsequentialDamages')}</div>` : ''}
                            ${terms.limitationOfLiability ? `<div class="rfp-result-commercial-item"><span class="label">Limitation of Liability:</span> ${terms.limitationOfLiability} ${getConfBadge('limitationOfLiability')}</div>` : ''}
                            ${terms.professionalLiability ? `<div class="rfp-result-commercial-item"><span class="label">Professional Liability:</span> ${terms.professionalLiability} ${getConfBadge('professionalLiability')}</div>` : ''}
                            ${terms.insuranceRequirements ? `<div class="rfp-result-commercial-item"><span class="label">Insurance:</span> ${terms.insuranceRequirements} ${getConfBadge('insuranceRequirements')}</div>` : ''}
                            ${terms.indemnification ? `<div class="rfp-result-commercial-item"><span class="label">Indemnification:</span> ${terms.indemnification} ${getConfBadge('indemnification')}</div>` : ''}
                        </div>
                    `;
                } else {
                    commercialContainer.innerHTML = '<div class="rfp-result-text empty">No commercial terms extracted. Consider re-analyzing with more pages.</div>';
                }
            }
            
            // Populate Confidence Scores
            const confidenceContainer = document.getElementById('rfp-result-confidence-grid');
            if (confidenceContainer) {
                const confidence = data.confidence || {};
                const confidenceLabels = {
                    scope: 'Scope',
                    phases: 'Phases',
                    disciplines: 'Disciplines',
                    packages: 'Packages',
                    schedule: 'Schedule',
                    quantities: 'Quantities',
                    budgets: 'Budgets'
                };
                
                const entries = Object.entries(confidence);
                if (entries.length > 0) {
                    confidenceContainer.innerHTML = entries.map(([key, value]) => {
                        const label = confidenceLabels[key] || key;
                        const level = (value || 'medium').toLowerCase();
                        return `
                            <div class="rfp-result-confidence">
                                <div class="rfp-result-confidence-label">${label}</div>
                                <div class="rfp-result-confidence-value ${level}">${value}</div>
                            </div>
                        `;
                    }).join('');
                } else {
                    confidenceContainer.innerHTML = '<div class="rfp-result-text empty">No confidence scores available.</div>';
                }
            }
        }

        /**
         * Shows the RFP Results button in the header
         */
        function showRfpResultsButton() {
            const btn = document.getElementById('rfp-results-btn');
            if (btn) {
                btn.classList.remove('hidden');
            }
        }

        /**
         * Hides the RFP Results button in the header
         */
        function hideRfpResultsButton() {
            const btn = document.getElementById('rfp-results-btn');
            if (btn) {
                btn.classList.add('hidden');
            }
        }

        // ============================================
        // GLOBAL EXPORTS FOR HTML ONCLICK HANDLERS
        // ============================================
        // These functions need to be accessible from HTML onclick attributes
        
        // Navigation
        window.nextStep = nextStep;
        window.prevStep = prevStep;
        window.goToStep = goToStep;
        window.generateWBS = generateWBS;
        window.editWBS = editWBS;
        
        // Templates
        window.toggleTemplateSelector = toggleTemplateSelector;
        window.applyTemplate = applyTemplate;
        
        // Phases
        window.addQuickPhase = addQuickPhase;
        
        // Disciplines
        window.toggleDisc = toggleDisc;
        window.addCustomDiscipline = addCustomDiscipline;
        window.selectAllDisciplines = selectAllDisciplines;
        
        // Packages
        window.addQuickPackage = addQuickPackage;
        
        // Budget & Calculator
        window.toggleCalculator = toggleCalculator;
        window.calculateBudgets = calculateBudgets;
        window.showComplexityOverrides = showComplexityOverrides;
        window.updateComplexityDefaults = updateComplexityDefaults;
        
        // MH Estimator
        window.toggleMHEstimator = toggleMHEstimator;
        window.updateMHProjectCost = updateMHProjectCost;
        window.updateMHInputs = updateMHInputs;
        window.resetMHEstimate = resetMHEstimate;
        window.showBenchmarkSelection = showBenchmarkSelection;
        window.showDisciplineBenchmark = showDisciplineBenchmark;
        window.applyMHEstimate = applyMHEstimate;
        window.toggleMHDiscipline = toggleMHDiscipline;
        
        // Claiming
        window.toggleClaimingPresets = toggleClaimingPresets;
        window.previewScheme = previewScheme;
        window.applyClaimingScheme = applyClaimingScheme;
        
        // Schedule
        window.generateAISchedule = generateAISchedule;
        
        // WBS Table
        window.expandAllWBS = expandAllWBS;
        window.collapseAllWBS = collapseAllWBS;
        window.toggleWBSEditMode = toggleWBSEditMode;
        window.showAddDisciplineModal = showAddDisciplineModal;
        window.showAddPackageModal = showAddPackageModal;
        window.showAddPhaseModal = showAddPhaseModal;
        window.closeAddModal = closeAddModal;
        window.confirmAddDiscipline = confirmAddDiscipline;
        window.confirmAddPackage = confirmAddPackage;
        window.confirmAddPhase = confirmAddPhase;
        window.recalculateBudgets = recalculateBudgets;
        window.confirmClearWBS = confirmClearWBS;
        
        // Charts
        window.updateChart = updateChart;
        
        // Gantt
        window.expandAllGantt = expandAllGantt;
        window.collapseAllGantt = collapseAllGantt;
        
        // Insights
        window.toggleInsightsPanel = toggleInsightsPanel;
        window.generateAIInsights = generateAIInsights;
        
        // Chat
        window.toggleChat = toggleChat;
        window.sendMessage = sendMessage;
        window.clearChat = clearChat;
        window.resetChatPosition = resetChatPosition;
        window.openChatSettings = openChatSettings;
        window.handleChatKeydown = handleChatKeydown;
        window.autoResizeChatInput = autoResizeChatInput;
        
        // RFP Wizard
        window.openRfpWizard = openRfpWizard;
        window.closeRfpWizard = closeRfpWizard;
        window.goToRfpStage = goToRfpStage;
        window.handleRfpFileSelect = handleRfpFileSelect;
        window.removeRfpFile = removeRfpFile;
        window.toggleTextPreview = toggleTextPreview;
        window.toggleFullTextPreview = toggleFullTextPreview;
        window.copyExtractedText = copyExtractedText;
        window.previewExtractedText = previewExtractedText;
        window.analyzeRfpDocument = analyzeRfpDocument;
        window.applyRfpData = applyRfpData;
        window.populateCostEstimatorFromRfp = populateCostEstimatorFromRfp;
        window.updateRfpQuantity = updateRfpQuantity;
        window.showQuantityReasoning = showQuantityReasoning;
        
        // RFP Results Panel
        window.openRfpResultsPanel = openRfpResultsPanel;
        window.closeRfpResultsPanel = closeRfpResultsPanel;
        window.toggleRfpResultSection = toggleRfpResultSection;
        
        // Reports
        window.openReportsPanel = openReportsPanel;
        window.closeReportsPanel = closeReportsPanel;
        window.generateDesignFeeBook = generateDesignFeeBook;
        window.shareProjectUrl = shareProjectUrl;
        window.importData = importData;
        
        // Projects Manager
        window.openProjectManager = openProjectManager;
        window.closeProjectManager = closeProjectManager;
        window.saveNamedProject = saveNamedProject;
        window.loadProject = loadProject;
        window.duplicateProject = duplicateProject;
        window.deleteProject = deleteProject;
        
        // Recovery Modal
        window.dismissRecovery = dismissRecovery;
        window.discardRecovery = discardRecovery;
        window.restoreRecovery = restoreRecovery;
        
        // API Key Modal
        window.showApiKeyModal = showApiKeyModal;
        window.hideApiKeyModal = hideApiKeyModal;
        window.saveApiKey = saveApiKey;
        
        // Inline editing - these are handled by editDisciplineBudget, editClaimPercent, etc.
        // window.startInlineEdit = startInlineEdit;  // Not a separate function
        // window.saveInlineEdit = saveInlineEdit;    // Not a separate function
        // window.cancelInlineEdit = cancelInlineEdit; // Not a separate function
        
        // Discipline functions (Step 2)
        window.toggleDisc = toggleDisc;
        window.initDisciplines = initDisciplines;
        window.updateSelectedCount = updateSelectedCount;
        
        // Budget table functions (Step 4)
        window.buildBudgetTable = buildBudgetTable;
        window.updateTotalBudget = updateTotalBudget;
        window.initCalculator = initCalculator;
        window.formatConstructionCostInput = formatConstructionCostInput;
        window.unformatConstructionCostInput = unformatConstructionCostInput;
        window.updateCalculatorTotal = updateCalculatorTotal;
        window.buildComplexityOverrideGrid = buildComplexityOverrideGrid;
        window.saveComplexityOverride = saveComplexityOverride;
        window.updateIndustryIndicators = updateIndustryIndicators;
        
        // MH Estimator additional
        window.initMHEstimator = initMHEstimator;
        window.updateMHRowDisplay = updateMHRowDisplay;
        window.updateMHQuantity = updateMHQuantity;
        window.updateL4Percentage = updateL4Percentage;
        window.toggleCostDropdown = toggleCostDropdown;
        window.recalculateTotalMH = recalculateTotalMH;
        window.toggleBenchmarkSection = toggleBenchmarkSection;
        window.toggleBenchmarkProject = toggleBenchmarkProject;
        window.closeBenchmarkModal = closeBenchmarkModal;
        window.applyBenchmarkSelection = applyBenchmarkSelection;
        window.buildAllProjectsRateTooltip = buildAllProjectsRateTooltip;
        window.buildSelectedRateTooltip = buildSelectedRateTooltip;
        window.buildQuantityReasoningTooltip = buildQuantityReasoningTooltip;
        window.updateBenchmarkChart = updateBenchmarkChart;
        window.switchBenchmarkChartDiscipline = switchBenchmarkChartDiscipline;
        
        // Claiming table functions (Step 5)
        window.buildClaimingTable = buildClaimingTable;
        window.updateClaimingTotals = updateClaimingTotals;
        
        // Schedule functions (Step 6)
        window.buildDatesTable = buildDatesTable;
        window.updateDurations = updateDurations;
        window.toggleReviewSteps = toggleReviewSteps;
        window.updateReviewStepDates = updateReviewStepDates;
        window.recalculateReviewSteps = recalculateReviewSteps;
        window.initializeUniqueIds = initializeUniqueIds;
        
        // WBS Table functions
        window.buildWBSTable = buildWBSTable;
        window.buildWBSTableEditable = buildWBSTableEditable;
        window.toggleWBSDiscipline = toggleWBSDiscipline;
        window.editDisciplineBudget = editDisciplineBudget;
        window.editClaimPercent = editClaimPercent;
        window.updateWBSDate = updateWBSDate;
        window.confirmDeleteDiscipline = confirmDeleteDiscipline;
        window.confirmDeletePackage = confirmDeletePackage;
        
        // Chart functions
        window.createChart = createChart;
        window.populateFilters = populateFilters;
        
        // Gantt functions
        window.buildGanttChart = buildGanttChart;
        window.toggleGanttDiscipline = toggleGanttDiscipline;
        window.showGanttTooltip = showGanttTooltip;
        window.hideGanttTooltip = hideGanttTooltip;
        window.moveGanttTooltip = moveGanttTooltip;
        
        // Step navigation helpers
        window.showStep = showStep;
        window.saveCurrentStep = saveCurrentStep;
        window.saveProjectInfo = saveProjectInfo;
        window.loadProjectInfo = loadProjectInfo;
        window.updateProgress = updateProgress;
        window.validate = validate;
        window.updateStatus = updateStatus;
        
        // KPIs and reporting
        window.updateKPIs = updateKPIs;
        window.calculateTotalBudget = calculateTotalBudget;
        window.updateReportsButtonVisibility = updateReportsButtonVisibility;
        
        // Export functions
        window.printReport = printReport;
        
        // AI and Chat helpers
        window.getChatContext = getChatContext;
        window.generateWBSDataForChat = generateWBSDataForChat;
        window.buildSystemPrompt = buildSystemPrompt;
        window.addWelcomeMessage = addWelcomeMessage;
        window.addMessage = addMessage;
        window.updateLastMessage = updateLastMessage;
        window.renderMessages = renderMessages;
        window.showTypingIndicator = showTypingIndicator;
        window.getValidApiKey = getValidApiKey;
        window.initChatDrag = initChatDrag;
        
        // Template functions
        window.populateTemplates = populateTemplates;
        
        // Utility functions
        window.formatTimestamp = formatTimestamp;
        window.formatCurrency = formatCurrency;
        window.formatAccountingInput = formatAccountingInput;
        window.calculateAssumedConstructionCost = calculateAssumedConstructionCost;
        window.toggleFieldEdit = toggleFieldEdit;
        window.calculateMarginPercent = calculateMarginPercent;
        window.toggleRevenueDetails = toggleRevenueDetails;
        
        // Escalation modal functions
        window.openEscalationModal = openEscalationModal;
        window.closeEscalationModal = closeEscalationModal;
        window.recalculateEscalation = recalculateEscalation;
        window.resetEscalationToDefault = resetEscalationToDefault;
        window.applyEscalationChanges = applyEscalationChanges;
        window.updateYearEscalationRate = updateYearEscalationRate;
        window.updateYearManualOverride = updateYearManualOverride;
        window.updateYearHourDistribution = updateYearHourDistribution;
        window.resetHourDistribution = resetHourDistribution;
        window.escapeHtml = escapeHtml;
        window.triggerAutosave = triggerAutosave;
        window.saveToLocalStorage = saveToLocalStorage;
        window.loadFromLocalStorage = loadFromLocalStorage;
        window.checkForSavedData = checkForSavedData;
        window.showRecoveryModal = showRecoveryModal;
        window.hasMeaningfulData = hasMeaningfulData;
        window.clearSavedData = clearSavedData;
        window.setupAutosaveListeners = setupAutosaveListeners;
        window.debounce = debounce;
        window.showAutosaveIndicator = showAutosaveIndicator;
        
        // Data structures
        window.allDisciplines = allDisciplines;
        window.exampleBudgets = exampleBudgets;
        window.claimingSchemes = claimingSchemes;
        window.STORAGE_KEY = STORAGE_KEY;
        
        // Make projectData and currentStep available globally
        window.projectData = projectData;
        window.currentStep = currentStep;
        
        console.log('WBS Terminal: All functions exported to global scope');
