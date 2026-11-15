import { Alert, Platform, Share } from 'react-native';
import { nativeVehicleSharePayload, type ShareableVehicle } from './vehicleSharing';

export async function shareVehicle(vehicle: ShareableVehicle, auctionId?: string | null) {
    try {
        await Share.share(nativeVehicleSharePayload(vehicle, Platform.OS, auctionId));
    } catch (error: unknown) {
        if (error instanceof Error && error.name === 'AbortError') return;
        Alert.alert('Unable to share', 'Your device could not open sharing. Please try again.');
    }
}
