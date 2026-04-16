export type TrackingEvent = {
  date: string | null;
  time: string | null;
  office: string | null;
  officeid: number | null;
  event: string | null;
};

export type TrackingItem = {
  consignment: string | null;
  status: string | null;
  last_event: {
    date: string | null;
    time: string | null;
    office: string | null;
    event: string | null;
  } | null;
  booking_details: Record<string, any>;
  tracking_details: TrackingEvent[];
};

export type TrackResponse = {
  upstream_message: string;
  count: number;
  items: TrackingItem[];
};

