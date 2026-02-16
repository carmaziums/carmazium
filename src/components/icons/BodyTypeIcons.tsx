/**
 * Body Type SVG Icons
 * Professional car silhouette icons for body type selection & filters.
 * All icons use a 40×20 viewBox and inherit currentColor.
 */

import React from 'react'

interface IconProps {
    className?: string
}

export function SedanIcon({ className }: IconProps) {
    return (
        <svg viewBox="0 0 40 20" fill="currentColor" className={className} xmlns="http://www.w3.org/2000/svg">
            <path d="M6 14h2a3 3 0 0 1 6 0h12a3 3 0 0 1 6 0h2c1 0 2-.5 2-1.5V11c0-1-1-2-3-2.5l-4-1.5-5-4C23 2 21 2 19 2h-5l-5 4-4 2C3 8.5 2 9 2 10.5v2C2 13.5 3 14 4 14h2z" />
            <circle cx="11" cy="14" r="2.5" fill="currentColor" opacity="0.7" />
            <circle cx="29" cy="14" r="2.5" fill="currentColor" opacity="0.7" />
        </svg>
    )
}

export function SUVIcon({ className }: IconProps) {
    return (
        <svg viewBox="0 0 40 20" fill="currentColor" className={className} xmlns="http://www.w3.org/2000/svg">
            <path d="M5 14h3a3 3 0 0 1 6 0h12a3 3 0 0 1 6 0h3c1 0 2-1 2-2v-3c0-1-.5-1.5-1-2l-3-2-3-3c-1-1-2-1.5-4-1.5H14c-2 0-3 .5-4 1.5L7 5 4 7c-.5.5-1 1-1 2v3c0 1 1 2 2 2z" />
            <circle cx="11" cy="14" r="2.5" fill="currentColor" opacity="0.7" />
            <circle cx="29" cy="14" r="2.5" fill="currentColor" opacity="0.7" />
        </svg>
    )
}

export function HatchbackIcon({ className }: IconProps) {
    return (
        <svg viewBox="0 0 40 20" fill="currentColor" className={className} xmlns="http://www.w3.org/2000/svg">
            <path d="M5 14h3a3 3 0 0 1 6 0h12a3 3 0 0 1 6 0h2c1 0 2-.5 2-1.5V11l-2-2-2-2-5-4c-1-.5-2-.5-3-.5h-6c-2 0-3 .5-4 1.5L6 7 4 9c-.5.5-1 1-1 2v1.5C3 13.5 4 14 5 14z" />
            <circle cx="11" cy="14" r="2.5" fill="currentColor" opacity="0.7" />
            <circle cx="29" cy="14" r="2.5" fill="currentColor" opacity="0.7" />
        </svg>
    )
}

export function CoupeIcon({ className }: IconProps) {
    return (
        <svg viewBox="0 0 40 20" fill="currentColor" className={className} xmlns="http://www.w3.org/2000/svg">
            <path d="M6 14h2a3 3 0 0 1 6 0h12a3 3 0 0 1 6 0h2c1.5 0 2.5-1 2.5-2V10c0-1-1-2-3-2.5L30 6l-7-4c-1-.5-2.5-.5-4-.5h-4L9 4 5 7c-1 .5-2 1.5-2 2.5v2.5c0 1 1.5 2 3 2z" />
            <circle cx="11" cy="14" r="2.5" fill="currentColor" opacity="0.7" />
            <circle cx="29" cy="14" r="2.5" fill="currentColor" opacity="0.7" />
        </svg>
    )
}

export function ConvertibleIcon({ className }: IconProps) {
    return (
        <svg viewBox="0 0 40 20" fill="currentColor" className={className} xmlns="http://www.w3.org/2000/svg">
            <path d="M6 14h2a3 3 0 0 1 6 0h12a3 3 0 0 1 6 0h2c1.5 0 2.5-1 2.5-2v-1.5c0-1-1-2-3-2.5L30 7H15L9 5 5 7.5C3.5 8 3 9 3 10v2c0 1 1.5 2 3 2z" />
            <circle cx="11" cy="14" r="2.5" fill="currentColor" opacity="0.7" />
            <circle cx="29" cy="14" r="2.5" fill="currentColor" opacity="0.7" />
        </svg>
    )
}

export function EstateIcon({ className }: IconProps) {
    return (
        <svg viewBox="0 0 40 20" fill="currentColor" className={className} xmlns="http://www.w3.org/2000/svg">
            <path d="M5 14h3a3 3 0 0 1 6 0h12a3 3 0 0 1 6 0h3c1 0 2-.5 2-1.5V8c0-.5 0-1-.5-1.5L35 5H28l-5-3c-1-.5-2-.5-3-.5h-6L8 4 5 6C3.5 6.5 3 7.5 3 8.5v4C3 13.5 4 14 5 14z" />
            <circle cx="11" cy="14" r="2.5" fill="currentColor" opacity="0.7" />
            <circle cx="29" cy="14" r="2.5" fill="currentColor" opacity="0.7" />
        </svg>
    )
}

export function CrossoverIcon({ className }: IconProps) {
    return (
        <svg viewBox="0 0 40 20" fill="currentColor" className={className} xmlns="http://www.w3.org/2000/svg">
            <path d="M5 14h3a3 3 0 0 1 6 0h12a3 3 0 0 1 6 0h3c1 0 2-.5 2-1.5V10c0-1-.5-2-2-2.5L32 6l-4-3c-1-1-2-1.5-4-1.5H16c-2 0-3 .5-4 1.5L8 6 5 7.5C3.5 8 3 9 3 10v2.5C3 13.5 4 14 5 14z" />
            <circle cx="11" cy="14" r="2.5" fill="currentColor" opacity="0.7" />
            <circle cx="29" cy="14" r="2.5" fill="currentColor" opacity="0.7" />
        </svg>
    )
}

export function SportsCarIcon({ className }: IconProps) {
    return (
        <svg viewBox="0 0 40 20" fill="currentColor" className={className} xmlns="http://www.w3.org/2000/svg">
            <path d="M6 15h2a3 3 0 0 1 6 0h12a3 3 0 0 1 6 0h3c1 0 2-1 2-2v-1c0-1-.5-1.5-2-2l-4-1-8-5c-1-.5-2-.5-3-.5h-3L8 6 4 9c-1 .5-1.5 1-1.5 2v2c0 1 1 2 2.5 2h1z" />
            <circle cx="11" cy="15" r="2.5" fill="currentColor" opacity="0.7" />
            <circle cx="29" cy="15" r="2.5" fill="currentColor" opacity="0.7" />
        </svg>
    )
}

export function MinivanIcon({ className }: IconProps) {
    return (
        <svg viewBox="0 0 40 20" fill="currentColor" className={className} xmlns="http://www.w3.org/2000/svg">
            <path d="M5 14h3a3 3 0 0 1 6 0h12a3 3 0 0 1 6 0h3c1 0 2-1 2-2V7c0-1-.5-2-2-2.5L33 3H22L14 2c-2 0-3 .5-4 1.5L6 7 4 9c-.5.5-1 1-1 2v1c0 1 1 2 2 2z" />
            <circle cx="11" cy="14" r="2.5" fill="currentColor" opacity="0.7" />
            <circle cx="29" cy="14" r="2.5" fill="currentColor" opacity="0.7" />
        </svg>
    )
}

export function PickupTruckIcon({ className }: IconProps) {
    return (
        <svg viewBox="0 0 40 20" fill="currentColor" className={className} xmlns="http://www.w3.org/2000/svg">
            <path d="M5 14h3a3 3 0 0 1 6 0h12a3 3 0 0 1 6 0h3c1 0 2-.5 2-1.5V10h-14V5c0-1-1-2-2-2h-5L9 5 5 8c-1 .5-2 1-2 2v2.5C3 13.5 4 14 5 14z" />
            <circle cx="11" cy="14" r="2.5" fill="currentColor" opacity="0.7" />
            <circle cx="29" cy="14" r="2.5" fill="currentColor" opacity="0.7" />
        </svg>
    )
}

export function StationWagonIcon({ className }: IconProps) {
    return (
        <svg viewBox="0 0 40 20" fill="currentColor" className={className} xmlns="http://www.w3.org/2000/svg">
            <path d="M5 14h3a3 3 0 0 1 6 0h12a3 3 0 0 1 6 0h3c1 0 2-.5 2-1.5V7.5c0-.5-.5-1-1-1.5L34 5H27l-5-3c-1-.5-2-.5-3-.5h-5L8 4 5 6.5C3.5 7 3 8 3 9v3.5C3 13.5 4 14 5 14z" />
            <circle cx="11" cy="14" r="2.5" fill="currentColor" opacity="0.7" />
            <circle cx="29" cy="14" r="2.5" fill="currentColor" opacity="0.7" />
        </svg>
    )
}

export function MPVIcon({ className }: IconProps) {
    return (
        <svg viewBox="0 0 40 20" fill="currentColor" className={className} xmlns="http://www.w3.org/2000/svg">
            <path d="M5 14h3a3 3 0 0 1 6 0h12a3 3 0 0 1 6 0h3c1 0 2-1 2-2V7c0-1-.5-2-1.5-2.5L33 3H21L13 2c-2 0-3 .5-4 1.5L5 7 3.5 9c-.3.5-.5 1-.5 1.5v1.5c0 1 1 2 2 2z" />
            <circle cx="11" cy="14" r="2.5" fill="currentColor" opacity="0.7" />
            <circle cx="29" cy="14" r="2.5" fill="currentColor" opacity="0.7" />
        </svg>
    )
}

export function VanIcon({ className }: IconProps) {
    return (
        <svg viewBox="0 0 40 20" fill="currentColor" className={className} xmlns="http://www.w3.org/2000/svg">
            <path d="M4 14h3a3 3 0 0 1 6 0h14a3 3 0 0 1 6 0h2c1 0 2-1 2-2V6c0-1.5-1-2.5-2.5-3H26l-4-1H10C8 2 6 3 5 4.5L3 8c-.5.5-1 1.5-1 2.5V12c0 1 1 2 2 2z" />
            <circle cx="10" cy="14" r="2.5" fill="currentColor" opacity="0.7" />
            <circle cx="30" cy="14" r="2.5" fill="currentColor" opacity="0.7" />
        </svg>
    )
}

// ─── Lookup Map ──────────────────────────────────────────────────────────────

export const BODY_TYPE_ICONS: Record<string, React.FC<IconProps>> = {
    SEDAN: SedanIcon,
    SUV: SUVIcon,
    HATCHBACK: HatchbackIcon,
    COUPE: CoupeIcon,
    CONVERTIBLE: ConvertibleIcon,
    ESTATE: EstateIcon,
    CROSSOVER: CrossoverIcon,
    SPORTS_CAR: SportsCarIcon,
    MINIVAN: MinivanIcon,
    PICKUP_TRUCK: PickupTruckIcon,
    STATION_WAGON: StationWagonIcon,
    MPV: MPVIcon,
    VAN: VanIcon,
}

export const BODY_TYPE_LABELS: Record<string, string> = {
    SEDAN: 'Sedan',
    SUV: 'SUV',
    HATCHBACK: 'Hatchback',
    COUPE: 'Coupé',
    CONVERTIBLE: 'Convertible',
    ESTATE: 'Estate',
    CROSSOVER: 'Crossover',
    SPORTS_CAR: 'Sports Car',
    MINIVAN: 'Minivan',
    PICKUP_TRUCK: 'Pickup Truck',
    STATION_WAGON: 'Station Wagon',
    MPV: 'MPV',
    VAN: 'Van',
}

export const BODY_TYPE_KEYS = [
    'SEDAN', 'SUV', 'HATCHBACK', 'COUPE', 'CONVERTIBLE', 'ESTATE',
    'CROSSOVER', 'SPORTS_CAR', 'MINIVAN', 'PICKUP_TRUCK', 'STATION_WAGON', 'MPV', 'VAN',
] as const
