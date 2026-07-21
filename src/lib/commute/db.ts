import { supabase } from '@/lib/supabase';
import {
  CommuteDestination,
  CommuteJob,
  CommuteTravelTime,
  JourneyLeg,
} from '@/lib/types';

// ─── DB row shapes ────────────────────────────────────────────────────────────

interface CommuteDestinationRow {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  weight: number;
  schedule: CommuteDestination['schedule'];
  created_at: string;
}

interface CommuteTravelTimeRow {
  cell_id: string;
  destination_id: string;
  weekday: number;
  target_time: string;
  duration_minutes: number | null;
  transfers: number | null;
  legs: JourneyLeg[] | null;
}

interface CommuteJobRow {
  id: string;
  status: CommuteJob['status'];
  total_cells: number;
  completed_cells: number;
  error: string | null;
  created_at: string;
  updated_at: string;
}

function rowToDestination(row: CommuteDestinationRow): CommuteDestination {
  return {
    id: row.id,
    name: row.name,
    address: row.address,
    lat: row.lat,
    lng: row.lng,
    weight: row.weight,
    schedule: row.schedule ?? [],
  };
}

function rowToTravelTime(row: CommuteTravelTimeRow): CommuteTravelTime {
  return {
    cellId: row.cell_id,
    destinationId: row.destination_id,
    weekday: row.weekday,
    targetTime: row.target_time,
    durationMinutes: row.duration_minutes,
    transfers: row.transfers,
    legs: row.legs,
  };
}

function rowToJob(row: CommuteJobRow): CommuteJob {
  return {
    id: row.id,
    status: row.status,
    totalCells: row.total_cells,
    completedCells: row.completed_cells,
    error: row.error,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ─── Destinations ─────────────────────────────────────────────────────────────

export async function fetchCommuteDestinations(): Promise<CommuteDestination[]> {
  const { data, error } = await supabase
    .from('commute_destinations')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data as CommuteDestinationRow[]).map(rowToDestination);
}

export async function insertCommuteDestination(dest: CommuteDestination): Promise<void> {
  const { error } = await supabase.from('commute_destinations').insert({
    id: dest.id,
    name: dest.name,
    address: dest.address,
    lat: dest.lat,
    lng: dest.lng,
    weight: dest.weight,
    schedule: dest.schedule,
  });
  if (error) throw error;
}

export async function updateCommuteDestination(dest: CommuteDestination): Promise<void> {
  const { error } = await supabase
    .from('commute_destinations')
    .update({
      name: dest.name,
      address: dest.address,
      lat: dest.lat,
      lng: dest.lng,
      weight: dest.weight,
      schedule: dest.schedule,
    })
    .eq('id', dest.id);
  if (error) throw error;
}

export async function deleteCommuteDestination(id: string): Promise<void> {
  const { error } = await supabase.from('commute_destinations').delete().eq('id', id);
  if (error) throw error;
}

// ─── Travel times ──────────────────────────────────────────────────────────────

export async function fetchTravelTimes(destinationIds: string[]): Promise<CommuteTravelTime[]> {
  if (destinationIds.length === 0) return [];
  const { data, error } = await supabase
    .from('commute_travel_times')
    .select('*')
    .in('destination_id', destinationIds);

  if (error) throw error;
  return (data as CommuteTravelTimeRow[]).map(rowToTravelTime);
}

export async function upsertTravelTime(travelTime: CommuteTravelTime): Promise<void> {
  const { error } = await supabase.from('commute_travel_times').upsert({
    cell_id: travelTime.cellId,
    destination_id: travelTime.destinationId,
    weekday: travelTime.weekday,
    target_time: travelTime.targetTime,
    duration_minutes: travelTime.durationMinutes,
    transfers: travelTime.transfers,
    legs: travelTime.legs,
  });
  if (error) throw error;
}

// ─── Jobs ─────────────────────────────────────────────────────────────────────

export async function initCommuteJob(id: string): Promise<void> {
  const { error } = await supabase.from('commute_jobs').insert({
    id,
    status: 'pending',
    total_cells: 0,
    completed_cells: 0,
  });
  if (error) throw error;
}

export async function setCommuteJobTotal(id: string, totalCells: number): Promise<void> {
  const { error } = await supabase
    .from('commute_jobs')
    .update({ status: 'running', total_cells: totalCells, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function updateCommuteJobProgress(
  id: string,
  completedCells: number,
): Promise<void> {
  const { error } = await supabase
    .from('commute_jobs')
    .update({ completed_cells: completedCells, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function finishCommuteJob(id: string, error: string | null): Promise<void> {
  const { error: dbError } = await supabase
    .from('commute_jobs')
    .update({
      status: error ? 'error' : 'done',
      error,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);
  if (dbError) throw dbError;
}

export async function fetchCommuteJob(id: string): Promise<CommuteJob | null> {
  const { data, error } = await supabase
    .from('commute_jobs')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToJob(data as CommuteJobRow) : null;
}

export async function fetchLatestCommuteJob(): Promise<CommuteJob | null> {
  const { data, error } = await supabase
    .from('commute_jobs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToJob(data as CommuteJobRow) : null;
}
