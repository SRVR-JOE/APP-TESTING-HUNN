import React, { useState, useMemo } from 'react';
import {
  Plus,
  Trash2,
  Pencil,
  Search,
  MapPin,
  Calendar,
  Users,
  Music,
  Building2,
  ChevronRight,
  ChevronDown,
  FileText,
  Truck,
  X,
  Check,
  Database,
  Link,
  ClipboardList,
  LayoutList,
  Globe,
} from 'lucide-react';
import { useTourStore } from '../store/useTourStore';
import type { Tour, TourStop, VenueProfile, VenueContact } from '@shared/types';
import { TourStopTimeline } from '../components/TourStopTimeline';
import { VenueCard } from '../components/VenueCard';
import { AdvanceSheetPreview } from '../components/AdvanceSheetPreview';

// =============================================================================
// Sub-components
// =============================================================================

// ---------- Tour Form (create / edit) ----------------------------------------

interface TourFormData {
  name: string;
  artist: string;
  productionCompany: string;
  startDate: string;
  endDate: string;
  notes: string;
  fleetSwitchIds: string;
}

const emptyTourForm: TourFormData = {
  name: '',
  artist: '',
  productionCompany: '',
  startDate: '',
  endDate: '',
  notes: '',
  fleetSwitchIds: '',
};

function tourToForm(tour: Tour): TourFormData {
  return {
    name: tour.name,
    artist: tour.artist ?? '',
    productionCompany: tour.productionCompany ?? '',
    startDate: tour.startDate,
    endDate: tour.endDate ?? '',
    notes: tour.notes ?? '',
    fleetSwitchIds: tour.fleetSwitchIds.join(', '),
  };
}

const TourForm: React.FC<{
  initial?: TourFormData;
  onSave: (data: TourFormData) => void;
  onCancel: () => void;
  title: string;
}> = ({ initial = emptyTourForm, onSave, onCancel, title }) => {
  const [form, setForm] = useState<TourFormData>(initial);
  const set = (field: keyof TourFormData, value: string) => setForm((f) => ({ ...f, [field]: value }));

  return (
    <div className="space-y-3">
      <h3 className="text-white font-semibold text-sm">{title}</h3>
      <Input label="Tour Name" value={form.name} onChange={(v) => set('name', v)} placeholder="e.g. Summer Arena Tour 2026" />
      <Input label="Artist" value={form.artist} onChange={(v) => set('artist', v)} placeholder="Artist or band name" />
      <Input label="Production Company" value={form.productionCompany} onChange={(v) => set('productionCompany', v)} placeholder="e.g. Solotech Productions" />
      <div className="grid grid-cols-2 gap-2">
        <Input label="Start Date" type="date" value={form.startDate} onChange={(v) => set('startDate', v)} />
        <Input label="End Date" type="date" value={form.endDate} onChange={(v) => set('endDate', v)} />
      </div>
      <Input label="Fleet Switch IDs" value={form.fleetSwitchIds} onChange={(v) => set('fleetSwitchIds', v)} placeholder="Comma-separated IDs" />
      <label className="block">
        <span className="text-xs text-gray-400 mb-1 block">Notes</span>
        <textarea
          className="w-full bg-gc-dark border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-gc-blue focus:outline-none resize-none"
          rows={3}
          value={form.notes}
          onChange={(e) => set('notes', e.target.value)}
          placeholder="Tour notes..."
        />
      </label>
      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={() => onSave(form)}
          disabled={!form.name.trim() || !form.startDate}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-gc-blue text-white hover:bg-gc-blue/80 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <Check className="w-3.5 h-3.5" /> Save
        </button>
        <button
          onClick={onCancel}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-800 text-gray-400 hover:text-white border border-gray-700 hover:border-gray-600 transition-colors"
        >
          <X className="w-3.5 h-3.5" /> Cancel
        </button>
      </div>
    </div>
  );
};

// ---------- Venue Form (create / edit) ---------------------------------------

interface VenueFormData {
  name: string;
  city: string;
  country: string;
  venueType: VenueProfile['venueType'];
  capacity: string;
  notes: string;
  internetDrop: boolean;
  existingVlans: string;
  houseSubnets: string;
  restrictions: string;
  cableInfrastructure: string;
  powerInfo: string;
  contacts: VenueContact[];
}

const emptyVenueForm: VenueFormData = {
  name: '',
  city: '',
  country: '',
  venueType: 'arena',
  capacity: '',
  notes: '',
  internetDrop: false,
  existingVlans: '',
  houseSubnets: '',
  restrictions: '',
  cableInfrastructure: '',
  powerInfo: '',
  contacts: [],
};

function venueToForm(v: VenueProfile): VenueFormData {
  return {
    name: v.name,
    city: v.city,
    country: v.country,
    venueType: v.venueType,
    capacity: v.capacity?.toString() ?? '',
    notes: v.notes ?? '',
    internetDrop: v.houseNetwork?.internetDrop ?? false,
    existingVlans: v.houseNetwork?.existingVlans?.join(', ') ?? '',
    houseSubnets: v.houseNetwork?.houseSubnets?.join(', ') ?? '',
    restrictions: v.houseNetwork?.restrictions ?? '',
    cableInfrastructure: v.cableInfrastructure ?? '',
    powerInfo: v.powerInfo ?? '',
    contacts: v.contacts ?? [],
  };
}

const venueTypes: VenueProfile['venueType'][] = [
  'arena', 'stadium', 'theater', 'festival', 'convention', 'broadcast-studio', 'outdoor', 'other',
];

const VenueForm: React.FC<{
  initial?: VenueFormData;
  onSave: (data: VenueFormData) => void;
  onCancel: () => void;
  title: string;
}> = ({ initial = emptyVenueForm, onSave, onCancel, title }) => {
  const [form, setForm] = useState<VenueFormData>(initial);
  const set = (field: keyof VenueFormData, value: unknown) => setForm((f) => ({ ...f, [field]: value }));

  const addContact = () => {
    set('contacts', [...form.contacts, { name: '', role: '', email: '', phone: '' }]);
  };

  const updateContact = (idx: number, field: keyof VenueContact, value: string) => {
    const updated = [...form.contacts];
    updated[idx] = { ...updated[idx], [field]: value };
    set('contacts', updated);
  };

  const removeContact = (idx: number) => {
    set('contacts', form.contacts.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-gray-700">
      <h3 className="text-white font-semibold text-sm">{title}</h3>
      <Input label="Venue Name" value={form.name} onChange={(v) => set('name', v)} placeholder="e.g. Madison Square Garden" />
      <div className="grid grid-cols-2 gap-2">
        <Input label="City" value={form.city} onChange={(v) => set('city', v)} placeholder="New York" />
        <Input label="Country" value={form.country} onChange={(v) => set('country', v)} placeholder="United States" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="text-xs text-gray-400 mb-1 block">Type</span>
          <select
            className="w-full bg-gc-dark border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-gc-blue focus:outline-none"
            value={form.venueType}
            onChange={(e) => set('venueType', e.target.value)}
          >
            {venueTypes.map((t) => (
              <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1).replace('-', ' ')}</option>
            ))}
          </select>
        </label>
        <Input label="Capacity" type="number" value={form.capacity} onChange={(v) => set('capacity', v)} placeholder="20000" />
      </div>

      {/* House Network */}
      <div className="border border-gray-700/50 rounded-lg p-3 space-y-2">
        <h4 className="text-xs font-semibold text-gray-300 uppercase tracking-wider">House Network</h4>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={form.internetDrop}
            onChange={(e) => set('internetDrop', e.target.checked)}
            className="rounded border-gray-600 bg-gc-dark text-gc-blue focus:ring-gc-blue"
          />
          <span className="text-xs text-gray-300">Internet drop available</span>
        </label>
        <Input label="Existing VLANs" value={form.existingVlans} onChange={(v) => set('existingVlans', v)} placeholder="1, 10, 20" />
        <Input label="House Subnets" value={form.houseSubnets} onChange={(v) => set('houseSubnets', v)} placeholder="192.168.1.0/24" />
        <Input label="Restrictions" value={form.restrictions} onChange={(v) => set('restrictions', v)} placeholder="No DHCP on house network" />
      </div>

      <Input label="Cable Infrastructure" value={form.cableInfrastructure} onChange={(v) => set('cableInfrastructure', v)} placeholder="House cable runs..." />
      <Input label="Power Info" value={form.powerInfo} onChange={(v) => set('powerInfo', v)} placeholder="400A 3-phase..." />

      <label className="block">
        <span className="text-xs text-gray-400 mb-1 block">Notes</span>
        <textarea
          className="w-full bg-gc-dark border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-gc-blue focus:outline-none resize-none"
          rows={2}
          value={form.notes}
          onChange={(e) => set('notes', e.target.value)}
        />
      </label>

      {/* Contacts */}
      <div className="border border-gray-700/50 rounded-lg p-3 space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Contacts</h4>
          <button onClick={addContact} className="text-xs text-gc-blue hover:text-gc-blue/80 flex items-center gap-1">
            <Plus className="w-3 h-3" /> Add
          </button>
        </div>
        {form.contacts.map((c, idx) => (
          <div key={idx} className="grid grid-cols-[1fr_1fr_auto] gap-1.5 items-end">
            <Input label="" value={c.name} onChange={(v) => updateContact(idx, 'name', v)} placeholder="Name" />
            <Input label="" value={c.role} onChange={(v) => updateContact(idx, 'role', v)} placeholder="Role" />
            <button onClick={() => removeContact(idx)} className="p-2 text-gray-500 hover:text-red-400">
              <X className="w-3.5 h-3.5" />
            </button>
            <Input label="" value={c.email ?? ''} onChange={(v) => updateContact(idx, 'email', v)} placeholder="Email" />
            <Input label="" value={c.phone ?? ''} onChange={(v) => updateContact(idx, 'phone', v)} placeholder="Phone" />
            <div />
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={() => onSave(form)}
          disabled={!form.name.trim() || !form.city.trim()}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-gc-blue text-white hover:bg-gc-blue/80 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <Check className="w-3.5 h-3.5" /> Save Venue
        </button>
        <button onClick={onCancel} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-800 text-gray-400 hover:text-white border border-gray-700 hover:border-gray-600 transition-colors">
          <X className="w-3.5 h-3.5" /> Cancel
        </button>
      </div>
    </div>
  );
};

// ---------- Stop Form --------------------------------------------------------

interface StopFormData {
  venueId: string;
  date: string;
  loadInTime: string;
  showTime: string;
  loadOutTime: string;
  notes: string;
}

const AddStopForm: React.FC<{
  venues: VenueProfile[];
  onSave: (data: StopFormData) => void;
  onCancel: () => void;
}> = ({ venues, onSave, onCancel }) => {
  const [form, setForm] = useState<StopFormData>({
    venueId: venues[0]?.id ?? '',
    date: '',
    loadInTime: '06:00',
    showTime: '20:00',
    loadOutTime: '23:00',
    notes: '',
  });
  const set = (field: keyof StopFormData, value: string) => setForm((f) => ({ ...f, [field]: value }));

  return (
    <div className="space-y-3 p-3 bg-gc-panel rounded-lg border border-gray-700/50">
      <h4 className="text-white font-semibold text-xs uppercase tracking-wider">Add Tour Stop</h4>
      <label className="block">
        <span className="text-xs text-gray-400 mb-1 block">Venue</span>
        <select
          className="w-full bg-gc-dark border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-gc-blue focus:outline-none"
          value={form.venueId}
          onChange={(e) => set('venueId', e.target.value)}
        >
          {venues.map((v) => (
            <option key={v.id} value={v.id}>{v.name} ({v.city})</option>
          ))}
        </select>
      </label>
      <Input label="Date" type="date" value={form.date} onChange={(v) => set('date', v)} />
      <div className="grid grid-cols-3 gap-2">
        <Input label="Load-in" type="time" value={form.loadInTime} onChange={(v) => set('loadInTime', v)} />
        <Input label="Show" type="time" value={form.showTime} onChange={(v) => set('showTime', v)} />
        <Input label="Load-out" type="time" value={form.loadOutTime} onChange={(v) => set('loadOutTime', v)} />
      </div>
      <Input label="Notes" value={form.notes} onChange={(v) => set('notes', v)} placeholder="Stop notes" />
      <div className="flex items-center gap-2">
        <button
          onClick={() => onSave(form)}
          disabled={!form.venueId || !form.date}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-gc-blue text-white hover:bg-gc-blue/80 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> Add Stop
        </button>
        <button onClick={onCancel} className="px-3 py-1.5 text-xs text-gray-400 hover:text-white transition-colors">
          Cancel
        </button>
      </div>
    </div>
  );
};

// ---------- Shared Input component -------------------------------------------

const Input: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}> = ({ label, value, onChange, placeholder, type = 'text' }) => (
  <label className="block">
    {label && <span className="text-xs text-gray-400 mb-1 block">{label}</span>}
    <input
      type={type}
      className="w-full bg-gc-dark border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-gc-blue focus:outline-none"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
    />
  </label>
);

// =============================================================================
// Main View
// =============================================================================

type RightPanelMode = 'tour-details' | 'stop-details' | 'none';

export const TourManagerView: React.FC = () => {
  const {
    tours,
    venues,
    activeTourId,
    activeStopId,
    advanceSheets,
    setActiveTour,
    setActiveStop,
    setActiveVenue,
    createTour,
    updateTour,
    deleteTour,
    createVenue,
    updateVenue,
    deleteVenue,
    addTourStop,
    removeTourStop,
    updateTourStop,
    linkShowFileToStop,
    generateAdvanceSheet,
  } = useTourStore();

  // UI state
  const [showVenueDatabase, setShowVenueDatabase] = useState(false);
  const [venueSearch, setVenueSearch] = useState('');
  const [tourSearch, setTourSearch] = useState('');
  const [isCreatingTour, setIsCreatingTour] = useState(false);
  const [editingTourId, setEditingTourId] = useState<string | null>(null);
  const [isCreatingVenue, setIsCreatingVenue] = useState(false);
  const [editingVenueId, setEditingVenueId] = useState<string | null>(null);
  const [isAddingStop, setIsAddingStop] = useState(false);
  const [generatedSheetStopId, setGeneratedSheetStopId] = useState<string | null>(null);

  // Derived
  const activeTour = tours.find((t) => t.id === activeTourId) ?? null;
  const activeStop = activeTour?.venueSchedule.find((s) => s.id === activeStopId) ?? null;
  const activeStopVenue = activeStop ? venues.find((v) => v.id === activeStop.venueId) : null;

  const filteredTours = useMemo(() => {
    if (!tourSearch.trim()) return tours;
    const q = tourSearch.toLowerCase();
    return tours.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.artist?.toLowerCase().includes(q) ||
        t.productionCompany?.toLowerCase().includes(q)
    );
  }, [tours, tourSearch]);

  const filteredVenues = useMemo(() => {
    if (!venueSearch.trim()) return venues;
    const q = venueSearch.toLowerCase();
    return venues.filter(
      (v) =>
        v.name.toLowerCase().includes(q) ||
        v.city.toLowerCase().includes(q) ||
        v.country.toLowerCase().includes(q) ||
        v.venueType.toLowerCase().includes(q)
    );
  }, [venues, venueSearch]);

  const rightPanelMode: RightPanelMode = activeStop ? 'stop-details' : activeTour ? 'tour-details' : 'none';

  // ---- Handlers ----

  const handleCreateTour = (data: TourFormData) => {
    createTour({
      name: data.name,
      artist: data.artist || undefined,
      productionCompany: data.productionCompany || undefined,
      startDate: data.startDate,
      endDate: data.endDate || undefined,
      showFileIds: [],
      venueSchedule: [],
      fleetSwitchIds: data.fleetSwitchIds.split(',').map((s) => s.trim()).filter(Boolean),
      notes: data.notes || undefined,
    });
    setIsCreatingTour(false);
  };

  const handleUpdateTour = (data: TourFormData) => {
    if (!editingTourId) return;
    updateTour(editingTourId, {
      name: data.name,
      artist: data.artist || undefined,
      productionCompany: data.productionCompany || undefined,
      startDate: data.startDate,
      endDate: data.endDate || undefined,
      fleetSwitchIds: data.fleetSwitchIds.split(',').map((s) => s.trim()).filter(Boolean),
      notes: data.notes || undefined,
    });
    setEditingTourId(null);
  };

  const handleCreateVenue = (data: VenueFormData) => {
    createVenue({
      name: data.name,
      city: data.city,
      country: data.country,
      venueType: data.venueType,
      capacity: data.capacity ? parseInt(data.capacity, 10) : undefined,
      notes: data.notes || undefined,
      houseNetwork: {
        internetDrop: data.internetDrop,
        existingVlans: data.existingVlans ? data.existingVlans.split(',').map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n)) : undefined,
        houseSubnets: data.houseSubnets ? data.houseSubnets.split(',').map((s) => s.trim()).filter(Boolean) : undefined,
        restrictions: data.restrictions || undefined,
      },
      previousConfigs: [],
      contacts: data.contacts.filter((c) => c.name.trim()),
      cableInfrastructure: data.cableInfrastructure || undefined,
      powerInfo: data.powerInfo || undefined,
    });
    setIsCreatingVenue(false);
  };

  const handleUpdateVenue = (data: VenueFormData) => {
    if (!editingVenueId) return;
    updateVenue(editingVenueId, {
      name: data.name,
      city: data.city,
      country: data.country,
      venueType: data.venueType,
      capacity: data.capacity ? parseInt(data.capacity, 10) : undefined,
      notes: data.notes || undefined,
      houseNetwork: {
        internetDrop: data.internetDrop,
        existingVlans: data.existingVlans ? data.existingVlans.split(',').map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n)) : undefined,
        houseSubnets: data.houseSubnets ? data.houseSubnets.split(',').map((s) => s.trim()).filter(Boolean) : undefined,
        restrictions: data.restrictions || undefined,
      },
      contacts: data.contacts.filter((c) => c.name.trim()),
      cableInfrastructure: data.cableInfrastructure || undefined,
      powerInfo: data.powerInfo || undefined,
    });
    setEditingVenueId(null);
  };

  const handleAddStop = (data: StopFormData) => {
    if (!activeTourId) return;
    const venue = venues.find((v) => v.id === data.venueId);
    addTourStop(activeTourId, {
      venueId: data.venueId,
      venueName: venue?.name ?? 'Unknown Venue',
      date: data.date,
      loadInTime: data.loadInTime || undefined,
      showTime: data.showTime || undefined,
      loadOutTime: data.loadOutTime || undefined,
      status: 'upcoming',
      notes: data.notes || undefined,
    });
    setIsAddingStop(false);
  };

  const handleGenerateAdvance = (stopId: string) => {
    generateAdvanceSheet(stopId);
    setGeneratedSheetStopId(stopId);
  };

  // ==========================================================================
  // Render
  // ==========================================================================

  return (
    <div className="flex flex-col h-full bg-gc-dark text-gray-200">
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-700/50 bg-gc-panel shrink-0">
        <div className="flex items-center gap-3">
          <Truck className="w-5 h-5 text-gc-blue" />
          <h1 className="text-white font-bold text-lg">Tour Manager</h1>
          <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full">
            {tours.length} tour{tours.length !== 1 ? 's' : ''} / {venues.length} venue{venues.length !== 1 ? 's' : ''}
          </span>
        </div>
        <button
          onClick={() => setShowVenueDatabase((v) => !v)}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
            showVenueDatabase
              ? 'bg-gc-blue/10 border-gc-blue text-gc-blue'
              : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white hover:border-gray-600'
          }`}
        >
          <Database className="w-3.5 h-3.5" />
          Venue Database
        </button>
      </div>

      {/* Main 3-panel layout */}
      <div className="flex flex-1 min-h-0">
        {/* ---- LEFT PANEL: Tour list ---- */}
        <div className="w-72 shrink-0 border-r border-gray-700/50 flex flex-col bg-gc-panel/50">
          <div className="p-3 border-b border-gray-700/50 space-y-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
              <input
                type="text"
                placeholder="Search tours..."
                className="w-full bg-gc-dark border border-gray-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-gray-600 focus:border-gc-blue focus:outline-none"
                value={tourSearch}
                onChange={(e) => setTourSearch(e.target.value)}
              />
            </div>
            <button
              onClick={() => setIsCreatingTour(true)}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-gc-blue text-white hover:bg-gc-blue/80 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> New Tour
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1.5 scrollbar-thin scrollbar-thumb-gray-700">
            {isCreatingTour && (
              <div className="p-3 bg-gc-dark rounded-lg border border-gc-blue/30">
                <TourForm title="Create Tour" onSave={handleCreateTour} onCancel={() => setIsCreatingTour(false)} />
              </div>
            )}

            {filteredTours.map((tour) => {
              const isActive = tour.id === activeTourId;
              const stopCount = tour.venueSchedule.length;
              const dateRange = tour.startDate
                ? `${formatShortDate(tour.startDate)}${tour.endDate ? ` - ${formatShortDate(tour.endDate)}` : ''}`
                : '';

              return (
                <button
                  key={tour.id}
                  onClick={() => { setActiveTour(tour.id); setActiveStop(null); }}
                  className={`w-full text-left rounded-lg border p-3 transition-all duration-150 ${
                    isActive
                      ? 'bg-gc-blue/10 border-gc-blue/40 ring-1 ring-gc-blue/20'
                      : 'bg-gc-panel border-gray-700/50 hover:border-gray-600'
                  }`}
                >
                  <div className="flex items-start justify-between mb-1">
                    <p className="text-white font-semibold text-sm truncate pr-2">{tour.name}</p>
                    <ChevronRight className={`w-4 h-4 shrink-0 transition-transform ${isActive ? 'text-gc-blue rotate-90' : 'text-gray-600'}`} />
                  </div>
                  {tour.artist && (
                    <div className="flex items-center gap-1 text-gray-400 text-xs mb-1">
                      <Music className="w-3 h-3" />
                      <span>{tour.artist}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1 text-gray-500 text-xs mb-1">
                    <Calendar className="w-3 h-3" />
                    <span>{dateRange}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    <span>{stopCount} stop{stopCount !== 1 ? 's' : ''}</span>
                    {tour.fleetSwitchIds.length > 0 && (
                      <span>{tour.fleetSwitchIds.length} fleet units</span>
                    )}
                  </div>
                </button>
              );
            })}

            {filteredTours.length === 0 && !isCreatingTour && (
              <div className="text-center py-8 text-gray-600 text-xs">
                {tourSearch ? 'No tours match your search.' : 'No tours yet. Create one to get started.'}
              </div>
            )}
          </div>
        </div>

        {/* ---- CENTER PANEL: Tour schedule / stops ---- */}
        <div className="flex-1 min-w-0 flex flex-col">
          {activeTour ? (
            <>
              {/* Tour header */}
              <div className="px-5 py-3 border-b border-gray-700/50 bg-gc-panel/30">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-white font-bold text-base">{activeTour.name}</h2>
                    <div className="flex items-center gap-3 text-xs text-gray-400 mt-0.5">
                      {activeTour.artist && <span>{activeTour.artist}</span>}
                      {activeTour.productionCompany && <span>by {activeTour.productionCompany}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setIsAddingStop(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-800 border border-gray-700 text-gray-300 hover:text-white hover:border-gray-600 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Stop
                    </button>
                    <button
                      onClick={() => setEditingTourId(activeTour.id)}
                      className="p-1.5 rounded-lg bg-gray-800 border border-gray-700 text-gray-400 hover:text-white hover:border-gray-600 transition-colors"
                      title="Edit tour"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => { if (confirm(`Delete tour "${activeTour.name}"?`)) deleteTour(activeTour.id); }}
                      className="p-1.5 rounded-lg bg-gray-800 border border-gray-700 text-gray-400 hover:text-red-400 hover:border-red-500/30 transition-colors"
                      title="Delete tour"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Horizontal timeline */}
              <div className="px-5 py-3 border-b border-gray-700/50">
                <TourStopTimeline
                  stops={activeTour.venueSchedule}
                  activeStopId={activeStopId}
                  onSelectStop={(id) => setActiveStop(id === activeStopId ? null : id)}
                  orientation="horizontal"
                />
              </div>

              {/* Scrollable timeline (vertical) + add stop form */}
              <div className="flex-1 overflow-y-auto p-5 scrollbar-thin scrollbar-thumb-gray-700">
                {isAddingStop && (
                  <div className="mb-4">
                    <AddStopForm venues={venues} onSave={handleAddStop} onCancel={() => setIsAddingStop(false)} />
                  </div>
                )}
                <TourStopTimeline
                  stops={activeTour.venueSchedule}
                  activeStopId={activeStopId}
                  onSelectStop={(id) => setActiveStop(id === activeStopId ? null : id)}
                  orientation="vertical"
                />
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <Truck className="w-12 h-12 text-gray-700 mx-auto mb-3" />
                <p className="text-gray-500 text-sm">Select a tour from the left panel</p>
                <p className="text-gray-600 text-xs mt-1">or create a new one to get started</p>
              </div>
            </div>
          )}
        </div>

        {/* ---- RIGHT PANEL: Contextual details ---- */}
        <div className="w-80 shrink-0 border-l border-gray-700/50 flex flex-col bg-gc-panel/50 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-700">
          {/* Editing tour */}
          {editingTourId && activeTour && editingTourId === activeTour.id ? (
            <div className="p-4">
              <TourForm
                title="Edit Tour"
                initial={tourToForm(activeTour)}
                onSave={handleUpdateTour}
                onCancel={() => setEditingTourId(null)}
              />
            </div>
          ) : rightPanelMode === 'stop-details' && activeStop ? (
            /* Stop details panel */
            <div className="p-4 space-y-4">
              <div>
                <h3 className="text-white font-bold text-sm mb-1">Stop Details</h3>
                <p className="text-gc-blue font-medium text-sm">{activeStop.venueName}</p>
                <p className="text-gray-400 text-xs">
                  {new Date(activeStop.date + 'T00:00:00').toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </p>
              </div>

              {/* Status */}
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Status</label>
                <select
                  className="w-full bg-gc-dark border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-gc-blue focus:outline-none"
                  value={activeStop.status}
                  onChange={(e) =>
                    activeTourId &&
                    updateTourStop(activeTourId, activeStop.id, {
                      status: e.target.value as TourStop['status'],
                    })
                  }
                >
                  <option value="upcoming">Upcoming</option>
                  <option value="in-progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              {/* Times */}
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <span className="text-xs text-gray-500 block">Load-in</span>
                  <span className="text-sm text-white font-mono">{activeStop.loadInTime ?? '--:--'}</span>
                </div>
                <div>
                  <span className="text-xs text-gray-500 block">Show</span>
                  <span className="text-sm text-white font-mono">{activeStop.showTime ?? '--:--'}</span>
                </div>
                <div>
                  <span className="text-xs text-gray-500 block">Load-out</span>
                  <span className="text-sm text-white font-mono">{activeStop.loadOutTime ?? '--:--'}</span>
                </div>
              </div>

              {/* Venue link */}
              {activeStopVenue && (
                <div className="border border-gray-700/50 rounded-lg p-3">
                  <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-2">
                    <Building2 className="w-3 h-3" />
                    <span className="uppercase tracking-wider font-semibold">Linked Venue</span>
                  </div>
                  <VenueCard venue={activeStopVenue} compact />
                  {activeStopVenue.houseNetwork && (
                    <div className="mt-2 text-xs text-gray-500">
                      <p>Internet: {activeStopVenue.houseNetwork.internetDrop ? 'Yes' : 'No'}</p>
                      {activeStopVenue.houseNetwork.restrictions && (
                        <p className="text-amber-500/80 mt-1">{activeStopVenue.houseNetwork.restrictions}</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Show file assignment */}
              <div className="border border-gray-700/50 rounded-lg p-3">
                <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-2">
                  <FileText className="w-3 h-3" />
                  <span className="uppercase tracking-wider font-semibold">Show File</span>
                </div>
                {activeStop.showFileId ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gc-accent bg-gc-accent/10 px-2 py-0.5 rounded border border-gc-accent/20">
                      {activeStop.showFileId}
                    </span>
                    <button
                      onClick={() => linkShowFileToStop(activeStop.id, '')}
                      className="text-xs text-gray-500 hover:text-red-400"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-gray-600">No show file assigned.</p>
                )}
              </div>

              {/* Advance sheet generator */}
              <div>
                <button
                  onClick={() => handleGenerateAdvance(activeStop.id)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 text-xs font-medium rounded-lg bg-gc-blue text-white hover:bg-gc-blue/80 transition-colors"
                >
                  <ClipboardList className="w-4 h-4" /> Generate Advance Sheet
                </button>
              </div>

              {/* Advance sheet preview */}
              {generatedSheetStopId === activeStop.id && advanceSheets[activeStop.id] && (
                <AdvanceSheetPreview
                  sheet={advanceSheets[activeStop.id]}
                  venueName={activeStop.venueName}
                  tourName={activeTour?.name}
                  stopDate={activeStop.date}
                />
              )}

              {/* Notes */}
              {activeStop.notes && (
                <div className="border-t border-gray-700/50 pt-3">
                  <span className="text-xs text-gray-500 block mb-1">Notes</span>
                  <p className="text-xs text-gray-300 leading-relaxed">{activeStop.notes}</p>
                </div>
              )}

              {/* Remove stop */}
              <button
                onClick={() => {
                  if (activeTourId && confirm('Remove this stop?')) {
                    removeTourStop(activeTourId, activeStop.id);
                  }
                }}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs text-red-400 hover:text-red-300 border border-red-500/20 hover:border-red-500/40 rounded-lg transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" /> Remove Stop
              </button>
            </div>
          ) : rightPanelMode === 'tour-details' && activeTour ? (
            /* Tour details panel */
            <div className="p-4 space-y-4">
              <h3 className="text-white font-bold text-sm">Tour Details</h3>

              <div className="space-y-3">
                <DetailRow label="Name" value={activeTour.name} />
                <DetailRow label="Artist" value={activeTour.artist ?? '--'} />
                <DetailRow label="Production Company" value={activeTour.productionCompany ?? '--'} />
                <DetailRow
                  label="Dates"
                  value={`${formatShortDate(activeTour.startDate)}${activeTour.endDate ? ` to ${formatShortDate(activeTour.endDate)}` : ''}`}
                />
                <DetailRow label="Stops" value={`${activeTour.venueSchedule.length}`} />

                {/* Fleet assignment */}
                <div>
                  <span className="text-xs text-gray-500 block mb-1">Fleet Assignment</span>
                  {activeTour.fleetSwitchIds.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {activeTour.fleetSwitchIds.map((fid) => (
                        <span key={fid} className="inline-flex items-center px-2 py-0.5 text-[10px] bg-gray-800 text-gray-300 rounded-full border border-gray-700">
                          {fid}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-600">No fleet switches assigned.</p>
                  )}
                </div>

                {/* Notes */}
                {activeTour.notes && (
                  <div>
                    <span className="text-xs text-gray-500 block mb-1">Notes</span>
                    <p className="text-xs text-gray-300 leading-relaxed">{activeTour.notes}</p>
                  </div>
                )}

                {/* Show files */}
                <div>
                  <span className="text-xs text-gray-500 block mb-1">Show Files</span>
                  {activeTour.showFileIds.length > 0 ? (
                    <div className="space-y-1">
                      {activeTour.showFileIds.map((sfId) => (
                        <span key={sfId} className="block text-xs text-gc-accent bg-gc-accent/10 px-2 py-1 rounded border border-gc-accent/20">
                          {sfId}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-600">No show files linked.</p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center p-4">
              <div className="text-center">
                <LayoutList className="w-10 h-10 text-gray-700 mx-auto mb-2" />
                <p className="text-gray-600 text-xs">Select a tour or stop to see details</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ---- VENUE DATABASE OVERLAY ---- */}
      {showVenueDatabase && (
        <div className="absolute inset-0 z-50 flex">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowVenueDatabase(false)} />

          {/* Panel */}
          <div className="relative ml-auto w-[560px] h-full bg-gc-dark border-l border-gray-700/50 flex flex-col shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-700/50 bg-gc-panel">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-gc-blue" />
                <h2 className="text-white font-bold text-sm">Venue Database</h2>
                <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full">{venues.length}</span>
              </div>
              <button
                onClick={() => setShowVenueDatabase(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Search + create */}
            <div className="px-5 py-3 border-b border-gray-700/50 space-y-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
                <input
                  type="text"
                  placeholder="Search venues by name, city, country, type..."
                  className="w-full bg-gc-dark border border-gray-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-gray-600 focus:border-gc-blue focus:outline-none"
                  value={venueSearch}
                  onChange={(e) => setVenueSearch(e.target.value)}
                />
              </div>
              <button
                onClick={() => { setIsCreatingVenue(true); setEditingVenueId(null); }}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-gc-blue text-white hover:bg-gc-blue/80 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> New Venue
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 scrollbar-thin scrollbar-thumb-gray-700">
              {isCreatingVenue && (
                <div className="mb-4 p-4 bg-gc-panel rounded-lg border border-gc-blue/30">
                  <VenueForm title="Create Venue" onSave={handleCreateVenue} onCancel={() => setIsCreatingVenue(false)} />
                </div>
              )}

              {editingVenueId && (
                <div className="mb-4 p-4 bg-gc-panel rounded-lg border border-gc-blue/30">
                  <VenueForm
                    title="Edit Venue"
                    initial={venueToForm(venues.find((v) => v.id === editingVenueId)!)}
                    onSave={handleUpdateVenue}
                    onCancel={() => setEditingVenueId(null)}
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                {filteredVenues.map((venue) => (
                  <div key={venue.id} className="relative group">
                    <VenueCard venue={venue} onClick={(id) => setActiveVenue(id)} />
                    {/* Action overlay */}
                    <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => { e.stopPropagation(); setEditingVenueId(venue.id); setIsCreatingVenue(false); }}
                        className="p-1 rounded bg-gray-800/90 border border-gray-700 text-gray-400 hover:text-white transition-colors"
                        title="Edit venue"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); if (confirm(`Delete "${venue.name}"?`)) deleteVenue(venue.id); }}
                        className="p-1 rounded bg-gray-800/90 border border-gray-700 text-gray-400 hover:text-red-400 transition-colors"
                        title="Delete venue"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {filteredVenues.length === 0 && !isCreatingVenue && (
                <div className="text-center py-12 text-gray-600 text-sm">
                  {venueSearch ? 'No venues match your search.' : 'No venues in database.'}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// =============================================================================
// Helpers
// =============================================================================

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const DetailRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div>
    <span className="text-xs text-gray-500 block">{label}</span>
    <span className="text-sm text-white">{value}</span>
  </div>
);

export default TourManagerView;
