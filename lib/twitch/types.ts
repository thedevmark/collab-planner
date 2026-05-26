export interface TwitchUser {
  id: string;
  login: string;
  display_name: string;
  profile_image_url: string;
  broadcaster_type: string;
  description: string;
}

export interface TwitchScheduleSegment {
  id: string;
  start_time: string;
  end_time: string;
  title: string;
  canceled_until: string | null;
  category: {
    id: string;
    name: string;
  } | null;
  is_recurring: boolean;
}

export interface TwitchScheduleVacation {
  start_time: string;
  end_time: string;
}

export interface TwitchSchedule {
  segments: TwitchScheduleSegment[] | null;
  broadcaster_id: string;
  broadcaster_name: string;
  broadcaster_login: string;
  vacation: TwitchScheduleVacation | null;
}

export interface TwitchGame {
  id: string;
  name: string;
  box_art_url: string;
}

export interface TwitchVideo {
  id: string;
  user_id: string;
  title: string;
  created_at: string;    // stream start time
  published_at: string;
  duration: string;      // e.g. "3h12m45s"
  game_id: string;
  game_name?: string;    // not always present on /videos
}

export interface TwitchChannel {
  id: string;
  broadcaster_login: string;
  display_name: string;
  thumbnail_url: string;
  is_live: boolean;
  game_name: string;
  title: string;
}

export interface TwitchFollower {
  user_id: string;
  user_login: string;
  user_name: string;
  followed_at: string;
}

export interface TwitchFollowedChannel {
  broadcaster_id: string;
  broadcaster_login: string;
  broadcaster_name: string;
  followed_at: string;
}

export interface TwitchStream {
  id: string;
  user_id: string;
  user_login: string;
  user_name: string;
  game_id: string;
  game_name: string;
  type: "live" | "";
  title: string;
  viewer_count: number;
  started_at: string;
  language: string;
  thumbnail_url: string;
}

export interface TwitchTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
}
