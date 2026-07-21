export type Exhibition = {
  id: string;
  organizerId: string;

  name: string;
  year: number;

  country: string;
  city?: string;

  sectorIds: string[];
  productGroupIds: string[];

  startDate?: string;
  endDate?: string;

  isActive: boolean;
};