/**
 * Navegación principal de la App Móvil Biosur.
 *
 * Estructura:
 * - AuthStack (no autenticado): Login
 * - MainStack (autenticado): Home, Inspeccion, ReporteFalla
 */

import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import LoginScreen from '../screens/LoginScreen';
import HomeScreen from '../screens/HomeScreen';
import InspeccionScreen from '../screens/InspeccionScreen';
import ReporteFallaScreen from '../screens/ReporteFallaScreen';
import type { Unidad } from '@biosur/shared';

export type RootStackParamList = {
  Login: undefined;
  Home: { unidadAsignada?: Unidad; nombreUsuario: string };
  Inspeccion: { unidadId: string };
  ReporteFalla: { codigoVerificacionId: number };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Login">
        <Stack.Screen
          name="Login"
          component={LoginScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Home"
          component={HomeScreen}
          options={{ title: 'Biosur Fleet' }}
        />
        <Stack.Screen
          name="Inspeccion"
          component={InspeccionScreen}
          options={{ title: 'Inspección Diaria' }}
        />
        <Stack.Screen
          name="ReporteFalla"
          component={ReporteFallaScreen}
          options={{ title: 'Reporte de Falla' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
