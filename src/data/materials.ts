import { Material } from '@/types/materials';

export const materials: Material[] = [
  {
    id: 'pla',
    name: 'PLA',
    costPerKg: 25,
    density: 1.24,
    color: 'material-pla',
    properties: {
      temperature: 60,
      flexibility: 'low',
      strength: 'medium',
      durability: 'medium',
    },
    description: 'Easy to print, biodegradable, ideal for beginners and prototypes',
  },
  {
    id: 'petg',
    name: 'PETG',
    costPerKg: 35,
    density: 1.27,
    color: 'material-petg',
    properties: {
      temperature: 80,
      flexibility: 'medium',
      strength: 'high',
      durability: 'high',
    },
    description: 'Chemical resistant, durable, excellent for functional parts',
  },
  {
    id: 'abs',
    name: 'ABS',
    costPerKg: 30,
    density: 1.04,
    color: 'material-abs',
    properties: {
      temperature: 100,
      flexibility: 'medium',
      strength: 'high',
      durability: 'high',
    },
    description: 'High temperature resistance, strong, perfect for automotive parts',
  },
  {
    id: 'nylon',
    name: 'Nylon',
    costPerKg: 60,
    density: 1.14,
    color: 'material-nylon',
    properties: {
      temperature: 120,
      flexibility: 'high',
      strength: 'high',
      durability: 'high',
    },
    description: 'Superior strength and flexibility, ideal for mechanical parts',
  },
];