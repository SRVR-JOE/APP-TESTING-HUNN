import { create } from 'zustand';
import type {
  Tour,
  TourStop,
  VenueProfile,
  AdvanceSheet,
  VenueContact,
} from '@shared/types';
import { generateAdvanceSheet } from '../lib/advance-sheet-engine';

// =============================================================================
// Mock Data — Realistic touring production
// =============================================================================

const MOCK_VENUES: VenueProfile[] = [
  {
    id: 'venue-msg',
    name: 'Madison Square Garden',
    city: 'New York',
    country: 'United States',
    venueType: 'arena',
    capacity: 20789,
    notes: 'Load-in via 33rd St loading dock. Union crew required. Elevator to floor level.',
    houseNetwork: {
      internetDrop: true,
      existingVlans: [1, 100, 200],
      houseSubnets: ['192.168.1.0/24'],
      restrictions: 'No DHCP servers on house network. Coordinate with venue IT for internet access.',
    },
    previousConfigs: ['sf-msg-2025'],
    contacts: [
      { name: 'Mike Reynolds', role: 'Production Manager', email: 'mreynolds@msg.com', phone: '+1 212-465-6741' },
      { name: 'Sarah Chen', role: 'House Audio Engineer', email: 'schen@msg.com', phone: '+1 212-465-6742' },
      { name: 'David Park', role: 'IT / Network Admin', email: 'dpark@msg.com', phone: '+1 212-465-6700' },
    ],
    cableInfrastructure: 'Cat6a house runs from FOH to stage (approx 200ft). Fiber trunks available between main patch room and FOH. Floor pockets every 30ft on stage.',
    powerInfo: '400A 3-phase service. Dedicated 20A technical power circuits at FOH and monitor world. Cam-lok distro at stage.',
    createdAt: '2025-06-15T10:00:00Z',
    updatedAt: '2025-12-01T14:30:00Z',
  },
  {
    id: 'venue-o2',
    name: 'The O2 Arena',
    city: 'London',
    country: 'United Kingdom',
    venueType: 'arena',
    capacity: 20000,
    notes: 'Load-in via North Greenwich entrance. Allow extra time for security clearance.',
    houseNetwork: {
      internetDrop: true,
      existingVlans: [1, 10, 50],
      houseSubnets: ['10.100.0.0/16'],
      restrictions: 'Venue requires 48hr advance notice for internet activation.',
    },
    previousConfigs: [],
    contacts: [
      { name: 'James Wilson', role: 'Head of Production', email: 'jwilson@theo2.co.uk', phone: '+44 20 8463 2000' },
      { name: 'Emma Thompson', role: 'Technical Manager', email: 'ethompson@theo2.co.uk', phone: '+44 20 8463 2001' },
    ],
    cableInfrastructure: 'House cat6 runs from production office to FOH (150m). Fiber available on request. Limited floor pocket access.',
    powerInfo: '600A 3-phase. Clean technical power available at FOH, monitor, and stage positions.',
    createdAt: '2025-07-20T09:00:00Z',
    updatedAt: '2025-11-15T11:00:00Z',
  },
  {
    id: 'venue-forum',
    name: 'The Forum',
    city: 'Los Angeles',
    country: 'United States',
    venueType: 'arena',
    capacity: 17505,
    notes: 'Historic venue. Some loading dock restrictions. Confirm rigging plan in advance.',
    houseNetwork: {
      internetDrop: true,
      existingVlans: [1],
      houseSubnets: ['192.168.10.0/24'],
      restrictions: 'Limited house network infrastructure. Bring your own cabling.',
    },
    previousConfigs: ['sf-forum-2024'],
    contacts: [
      { name: 'Carlos Mendez', role: 'Venue Production Manager', email: 'cmendez@theforum.com', phone: '+1 310-330-7300' },
    ],
    cableInfrastructure: 'Minimal house cabling. Recommend bringing full cable package. FOH to stage approx 250ft.',
    powerInfo: '400A service. Dedicated tech power at FOH. Stage power via house distro.',
    createdAt: '2025-05-10T08:00:00Z',
    updatedAt: '2025-10-20T16:00:00Z',
  },
  {
    id: 'venue-scotiabank',
    name: 'Scotiabank Arena',
    city: 'Toronto',
    country: 'Canada',
    venueType: 'arena',
    capacity: 19800,
    notes: 'Load-in via Gate 1 (Bremner Blvd). Advance rigger call required.',
    houseNetwork: {
      internetDrop: true,
      existingVlans: [1, 10, 20, 99],
      houseSubnets: ['172.16.0.0/16'],
      restrictions: 'Must use house DHCP for internet access. No bridging to house VLANs.',
    },
    previousConfigs: [],
    contacts: [
      { name: 'Rob MacIntyre', role: 'Production Director', email: 'rmacintyre@scotiabankarena.com', phone: '+1 416-815-5500' },
      { name: 'Kim Nguyen', role: 'Audio Technician', email: 'knguyen@scotiabankarena.com', phone: '+1 416-815-5501' },
    ],
    cableInfrastructure: 'Full Cat6a infrastructure with patch panels at FOH, monitor world, and all stage positions. Fiber backbone.',
    powerInfo: '800A 3-phase. Isolated technical power distro. UPS in main tech room.',
    createdAt: '2025-08-01T12:00:00Z',
    updatedAt: '2026-01-10T09:00:00Z',
  },
  {
    id: 'venue-ziggo',
    name: 'Ziggo Dome',
    city: 'Amsterdam',
    country: 'Netherlands',
    venueType: 'arena',
    capacity: 17000,
    notes: 'Excellent venue infrastructure. Advance with house crew for rigging.',
    houseNetwork: {
      internetDrop: true,
      existingVlans: [1, 10, 20, 30],
      houseSubnets: ['10.200.0.0/16'],
      restrictions: 'Venue runs Dante on VLAN 10. Coordinate to avoid conflicts.',
    },
    previousConfigs: [],
    contacts: [
      { name: 'Hans de Vries', role: 'Technical Director', email: 'hdevries@ziggodome.nl', phone: '+31 20 409 9999' },
    ],
    cableInfrastructure: 'State-of-the-art Cat6a and fiber infrastructure throughout. Floor boxes every 5m.',
    powerInfo: '1000A 3-phase. Clean power throughout. Built-in UPS for technical areas.',
    createdAt: '2025-09-15T10:00:00Z',
    updatedAt: '2026-02-01T08:00:00Z',
  },
  {
    id: 'venue-budokan',
    name: 'Nippon Budokan',
    city: 'Tokyo',
    country: 'Japan',
    venueType: 'arena',
    capacity: 14471,
    notes: 'Iconic venue. Strict noise curfew at 21:00. No pyro.',
    houseNetwork: {
      internetDrop: true,
      existingVlans: [1],
      houseSubnets: ['192.168.0.0/24'],
      restrictions: 'Limited network infrastructure. Bring full kit.',
    },
    previousConfigs: [],
    contacts: [
      { name: 'Takeshi Yamamoto', role: 'Venue Manager', email: 'tyamamoto@nipponbudokan.or.jp', phone: '+81 3-3216-5100' },
    ],
    cableInfrastructure: 'Basic house cabling. FOH to stage approx 60m. Bring own fiber and Cat6a.',
    powerInfo: '100V/200V power. Bring step-down transformers if needed. 300A service.',
    createdAt: '2025-10-01T06:00:00Z',
    updatedAt: '2026-01-20T04:00:00Z',
  },
];

const MOCK_TOURS: Tour[] = [
  {
    id: 'tour-summer-2026',
    name: 'Summer Arena Tour 2026',
    artist: 'The Luminaires',
    productionCompany: 'Solotech Productions',
    startDate: '2026-06-15',
    endDate: '2026-09-20',
    showFileIds: ['sf-arena-main-2026'],
    venueSchedule: [
      {
        id: 'stop-1',
        venueId: 'venue-msg',
        venueName: 'Madison Square Garden',
        date: '2026-06-15',
        loadInTime: '06:00',
        showTime: '20:00',
        loadOutTime: '23:30',
        showFileId: 'sf-arena-main-2026',
        status: 'upcoming',
        notes: 'Opening night. Extra production rehearsal day on June 14.',
      },
      {
        id: 'stop-2',
        venueId: 'venue-scotiabank',
        venueName: 'Scotiabank Arena',
        date: '2026-06-22',
        loadInTime: '07:00',
        showTime: '20:00',
        loadOutTime: '23:00',
        status: 'upcoming',
        notes: 'Second show. Local crew call at 07:00.',
      },
      {
        id: 'stop-3',
        venueId: 'venue-forum',
        venueName: 'The Forum',
        date: '2026-07-05',
        loadInTime: '06:00',
        showTime: '19:30',
        loadOutTime: '23:00',
        showFileId: 'sf-arena-main-2026',
        status: 'upcoming',
        notes: 'LA show. Possible livestream — coordinate with broadcast team.',
      },
      {
        id: 'stop-4',
        venueId: 'venue-o2',
        venueName: 'The O2 Arena',
        date: '2026-07-20',
        loadInTime: '08:00',
        showTime: '20:30',
        loadOutTime: '00:00',
        showFileId: 'sf-arena-main-2026',
        status: 'upcoming',
        notes: 'UK date. Customs clearance required for equipment.',
      },
      {
        id: 'stop-5',
        venueId: 'venue-ziggo',
        venueName: 'Ziggo Dome',
        date: '2026-07-25',
        loadInTime: '07:00',
        showTime: '20:00',
        loadOutTime: '23:30',
        status: 'upcoming',
        notes: 'Amsterdam show. Coordinate VLAN scheme with house Dante network.',
      },
      {
        id: 'stop-6',
        venueId: 'venue-budokan',
        venueName: 'Nippon Budokan',
        date: '2026-08-10',
        loadInTime: '06:00',
        showTime: '19:00',
        loadOutTime: '21:30',
        showFileId: 'sf-arena-main-2026',
        status: 'upcoming',
        notes: 'Tokyo date. Strict 21:00 curfew. Power transformer check required.',
      },
    ],
    fleetSwitchIds: ['fleet-gc30-001', 'fleet-gc30-002', 'fleet-gc16-001', 'fleet-gc16-002', 'fleet-gc10-001'],
    notes: 'Full arena production. 12-truck tour with full lighting, audio, and video package. Network team: 2 engineers.',
    createdAt: '2026-01-10T09:00:00Z',
    updatedAt: '2026-03-15T14:00:00Z',
  },
  {
    id: 'tour-festival-2026',
    name: 'Festival Circuit 2026',
    artist: 'The Luminaires',
    productionCompany: 'Solotech Productions',
    startDate: '2026-05-01',
    endDate: '2026-08-30',
    showFileIds: ['sf-festival-2026'],
    venueSchedule: [
      {
        id: 'stop-f1',
        venueId: 'venue-msg',
        venueName: 'Madison Square Garden',
        date: '2026-05-15',
        loadInTime: '08:00',
        showTime: '21:00',
        loadOutTime: '01:00',
        status: 'upcoming',
        notes: 'Festival pre-show warm-up gig.',
      },
    ],
    fleetSwitchIds: ['fleet-gc16-003', 'fleet-gc10-002'],
    notes: 'Festival fly-pack configuration. Lightweight rig.',
    createdAt: '2026-02-01T10:00:00Z',
    updatedAt: '2026-03-10T08:00:00Z',
  },
];

// =============================================================================
// Store Interface
// =============================================================================

export interface TourState {
  tours: Tour[];
  venues: VenueProfile[];
  activeTourId: string | null;
  activeVenueId: string | null;
  activeStopId: string | null;
  advanceSheets: Record<string, AdvanceSheet>;

  // Tour CRUD
  createTour: (tour: Omit<Tour, 'id' | 'createdAt' | 'updatedAt'>) => string;
  updateTour: (id: string, updates: Partial<Tour>) => void;
  deleteTour: (id: string) => void;

  // Venue CRUD
  createVenue: (venue: Omit<VenueProfile, 'id' | 'createdAt' | 'updatedAt'>) => string;
  updateVenue: (id: string, updates: Partial<VenueProfile>) => void;
  deleteVenue: (id: string) => void;

  // Tour Stop management
  addTourStop: (tourId: string, stop: Omit<TourStop, 'id'>) => string;
  updateTourStop: (tourId: string, stopId: string, updates: Partial<TourStop>) => void;
  removeTourStop: (tourId: string, stopId: string) => void;

  // Show file linking
  linkShowFileToStop: (stopId: string, showFileId: string) => void;

  // Advance sheet generation
  generateAdvanceSheet: (tourStopId: string) => AdvanceSheet | null;

  // Selection
  setActiveTour: (id: string | null) => void;
  setActiveVenue: (id: string | null) => void;
  setActiveStop: (id: string | null) => void;
}

// =============================================================================
// Store
// =============================================================================

export const useTourStore = create<TourState>((set, get) => ({
  tours: MOCK_TOURS,
  venues: MOCK_VENUES,
  activeTourId: MOCK_TOURS[0]?.id ?? null,
  activeVenueId: null,
  activeStopId: null,
  advanceSheets: {},

  // ---- Tour CRUD ------------------------------------------------------------

  createTour: (tourData) => {
    const id = `tour-${Date.now()}`;
    const now = new Date().toISOString();
    const tour: Tour = {
      ...tourData,
      id,
      createdAt: now,
      updatedAt: now,
    };
    set((state) => ({ tours: [...state.tours, tour] }));
    return id;
  },

  updateTour: (id, updates) => {
    set((state) => ({
      tours: state.tours.map((t) =>
        t.id === id ? { ...t, ...updates, updatedAt: new Date().toISOString() } : t
      ),
    }));
  },

  deleteTour: (id) => {
    set((state) => ({
      tours: state.tours.filter((t) => t.id !== id),
      activeTourId: state.activeTourId === id ? null : state.activeTourId,
    }));
  },

  // ---- Venue CRUD -----------------------------------------------------------

  createVenue: (venueData) => {
    const id = `venue-${Date.now()}`;
    const now = new Date().toISOString();
    const venue: VenueProfile = {
      ...venueData,
      id,
      createdAt: now,
      updatedAt: now,
    };
    set((state) => ({ venues: [...state.venues, venue] }));
    return id;
  },

  updateVenue: (id, updates) => {
    set((state) => ({
      venues: state.venues.map((v) =>
        v.id === id ? { ...v, ...updates, updatedAt: new Date().toISOString() } : v
      ),
    }));
  },

  deleteVenue: (id) => {
    set((state) => ({
      venues: state.venues.filter((v) => v.id !== id),
      activeVenueId: state.activeVenueId === id ? null : state.activeVenueId,
    }));
  },

  // ---- Tour Stop management -------------------------------------------------

  addTourStop: (tourId, stopData) => {
    const stopId = `stop-${Date.now()}`;
    const stop: TourStop = { ...stopData, id: stopId };
    set((state) => ({
      tours: state.tours.map((t) =>
        t.id === tourId
          ? {
              ...t,
              venueSchedule: [...t.venueSchedule, stop],
              updatedAt: new Date().toISOString(),
            }
          : t
      ),
    }));
    return stopId;
  },

  updateTourStop: (tourId, stopId, updates) => {
    set((state) => ({
      tours: state.tours.map((t) =>
        t.id === tourId
          ? {
              ...t,
              venueSchedule: t.venueSchedule.map((s) => (s.id === stopId ? { ...s, ...updates } : s)),
              updatedAt: new Date().toISOString(),
            }
          : t
      ),
    }));
  },

  removeTourStop: (tourId, stopId) => {
    set((state) => ({
      tours: state.tours.map((t) =>
        t.id === tourId
          ? {
              ...t,
              venueSchedule: t.venueSchedule.filter((s) => s.id !== stopId),
              updatedAt: new Date().toISOString(),
            }
          : t
      ),
      activeStopId: state.activeStopId === stopId ? null : state.activeStopId,
    }));
  },

  // ---- Show file linking ----------------------------------------------------

  linkShowFileToStop: (stopId, showFileId) => {
    set((state) => ({
      tours: state.tours.map((t) => ({
        ...t,
        venueSchedule: t.venueSchedule.map((s) =>
          s.id === stopId ? { ...s, showFileId } : s
        ),
      })),
    }));
  },

  // ---- Advance sheet generation ---------------------------------------------

  generateAdvanceSheet: (tourStopId) => {
    const state = get();
    let tourStop: TourStop | undefined;

    for (const tour of state.tours) {
      tourStop = tour.venueSchedule.find((s) => s.id === tourStopId);
      if (tourStop) break;
    }

    if (!tourStop) return null;

    const venue = state.venues.find((v) => v.id === tourStop!.venueId);
    // showFile would come from another store in production; pass undefined here
    const sheet = generateAdvanceSheet(tourStop, venue, undefined);

    set((state) => ({
      advanceSheets: { ...state.advanceSheets, [tourStopId]: sheet },
    }));

    return sheet;
  },

  // ---- Selection ------------------------------------------------------------

  setActiveTour: (id) => set({ activeTourId: id, activeStopId: null }),
  setActiveVenue: (id) => set({ activeVenueId: id }),
  setActiveStop: (id) => set({ activeStopId: id }),
}));
