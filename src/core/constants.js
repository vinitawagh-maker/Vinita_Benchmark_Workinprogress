/**
 * Application Constants and Configuration
 * @module core/constants
 */

// Storage keys
export const STORAGE_KEY = 'wbs_project_autosave';
export const STORAGE_VERSION = 1;
export const PROJECTS_STORAGE_KEY = 'wbs_saved_projects';
export const API_KEY_STORAGE = 'wbs_openai_api_key';

// Default configuration
export const DEFAULT_HOURLY_RATE = 150;
export const AUTOSAVE_DELAY = 1000;

// Discipline configuration with industry-standard percentages
export const DISCIPLINE_CONFIG = {
    roadway: { name: 'Roadway', defaultPct: 25, range: [20, 30], icon: '🛣️' },
    drainage: { name: 'Drainage', defaultPct: 12, range: [10, 15], icon: '💧' },
    structures: { name: 'Structures', defaultPct: 18, range: [15, 25], icon: '🌉' },
    traffic: { name: 'Traffic', defaultPct: 8, range: [5, 12], icon: '🚦' },
    signals: { name: 'Signals', defaultPct: 5, range: [3, 8], icon: '🚥' },
    lighting: { name: 'Lighting', defaultPct: 4, range: [2, 6], icon: '💡' },
    signing: { name: 'Signing', defaultPct: 3, range: [2, 5], icon: '🪧' },
    pavement: { name: 'Pavement Marking', defaultPct: 2, range: [1, 4], icon: '〰️' },
    landscaping: { name: 'Landscaping', defaultPct: 3, range: [2, 5], icon: '🌳' },
    utilities: { name: 'Utilities', defaultPct: 6, range: [4, 10], icon: '⚡' },
    environmental: { name: 'Environmental', defaultPct: 4, range: [3, 8], icon: '🌿' },
    survey: { name: 'Survey', defaultPct: 3, range: [2, 5], icon: '📐' },
    geotech: { name: 'Geotechnical', defaultPct: 3, range: [2, 5], icon: '🪨' },
    rightOfWay: { name: 'Right of Way', defaultPct: 2, range: [1, 4], icon: '📋' },
    publicInvolvement: { name: 'Public Involvement', defaultPct: 2, range: [1, 3], icon: '👥' }
};

// Claiming scheme presets
export const CLAIMING_SCHEMES = {
    linear: {
        name: 'Linear/Even',
        description: 'Equal distribution across all packages',
        generate: (count) => Array(count).fill(Math.round(100 / count))
    },
    frontLoaded: {
        name: 'Front-Loaded',
        description: 'Higher % early, declining',
        presets: {
            5: [30, 25, 20, 15, 10],
            4: [35, 30, 20, 15],
            3: [45, 35, 20],
            6: [25, 22, 18, 15, 12, 8]
        }
    },
    backLoaded: {
        name: 'Back-Loaded',
        description: 'Lower % early, increasing',
        presets: {
            5: [10, 15, 20, 25, 30],
            4: [15, 20, 30, 35],
            3: [20, 35, 45],
            6: [8, 12, 15, 18, 22, 25]
        }
    },
    bellCurve: {
        name: 'Bell Curve',
        description: 'Peak in middle packages',
        presets: {
            5: [10, 20, 40, 20, 10],
            4: [15, 35, 35, 15],
            3: [25, 50, 25],
            6: [8, 15, 27, 27, 15, 8]
        }
    }
};

// Project templates
export const PROJECT_TEMPLATES = {
    highway: {
        name: 'Highway Reconstruction',
        icon: '🛣️',
        phases: ['Base', 'ESDC', 'TSCD', 'As-Builts'],
        disciplines: ['Roadway', 'Drainage', 'Traffic', 'Signing', 'Pavement Marking', 'Utilities', 'Survey'],
        packages: ['Preliminary', 'Interim', 'Final', 'RFC', 'As-Built']
    },
    bridge: {
        name: 'Bridge Replacement',
        icon: '🌉',
        phases: ['Base', 'ESDC', 'TSCD'],
        disciplines: ['Structures', 'Roadway', 'Drainage', 'Geotechnical', 'Traffic', 'Utilities'],
        packages: ['Preliminary', 'Interim', 'Final', 'RFC']
    },
    drainage: {
        name: 'Drainage Improvement',
        icon: '💧',
        phases: ['Base', 'Final'],
        disciplines: ['Drainage', 'Roadway', 'Utilities', 'Environmental', 'Survey'],
        packages: ['Preliminary', 'Final', 'RFC']
    },
    intersection: {
        name: 'Intersection Improvement',
        icon: '🔀',
        phases: ['Base', 'Final'],
        disciplines: ['Roadway', 'Traffic', 'Signals', 'Signing', 'Pavement Marking', 'Drainage'],
        packages: ['Preliminary', 'Interim', 'Final', 'RFC']
    },
    multiDiscipline: {
        name: 'Multi-Discipline Infrastructure',
        icon: '🏗️',
        phases: ['Base', 'ESDC', 'TSCD', 'As-Builts', 'Closeout'],
        disciplines: ['Roadway', 'Structures', 'Drainage', 'Traffic', 'Signals', 'Lighting', 'Signing', 'Utilities', 'Environmental', 'Survey', 'Geotechnical'],
        packages: ['Preliminary', 'Interim', 'Final', 'RFC', 'As-Built']
    },
    transit: {
        name: 'Transit/Rail Station',
        icon: '🚇',
        phases: ['Base', 'ESDC', 'TSCD'],
        disciplines: ['Structures', 'Track', 'Systems', 'Traffic', 'Drainage', 'Utilities', 'Landscaping'],
        packages: ['Preliminary', 'Interim', 'Final', 'RFC']
    }
};

// Available disciplines for selection
export const AVAILABLE_DISCIPLINES = [
    'Roadway', 'Drainage', 'Structures', 'Traffic', 'Signals',
    'Lighting', 'Signing', 'Pavement Marking', 'Landscaping',
    'Utilities', 'Environmental', 'Survey', 'Geotechnical',
    'Right of Way', 'Public Involvement', 'Track', 'Systems', 'MOT'
];

// OpenAI configuration
export const OPENAI_CONFIG = {
    model: 'gpt-5.4',
    maxTokens: 2000,
    temperature: 0.7
};

