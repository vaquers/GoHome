import { requestJsonWithApiFallback, cachedGet } from './apiBase';

export type ParticipantDto = {
  id: number;
  firstName?: string;
  lastName?: string;
  name?: string;
  order?: number;
  previewImage?: string;
};

export type VotingNomination = 'defile' | 'photos';

export type VoteRequest = {
  tg_id: number;
  first_name: string;
  last_name: string;
  voter_class: string;
  participant_id: number;
  nomination: VotingNomination;
};

export async function getParticipants(signal?: AbortSignal): Promise<ParticipantDto[]> {
  return await requestJsonWithApiFallback<ParticipantDto[]>('/participants', { signal });
}

export async function hasVoted(tgId: number, signal?: AbortSignal): Promise<unknown> {
  return await requestJsonWithApiFallback(`/has-voted/${tgId}`, { signal });
}

export async function vote(req: VoteRequest): Promise<unknown> {
  return await requestJsonWithApiFallback('/vote', {
    method: 'POST',
    body: JSON.stringify({
      tg_id: req.tg_id,
      first_name: req.first_name,
      last_name: req.last_name,
      voter_class: req.voter_class,
      participant_id: req.participant_id,
      nomination: req.nomination,
      stage: req.nomination,
      category: req.nomination,
    }),
  });
}

export async function getResults(signal?: AbortSignal): Promise<unknown> {
  return await requestJsonWithApiFallback('/results', { signal });
}

export async function getVoters(signal?: AbortSignal): Promise<unknown> {
  return await requestJsonWithApiFallback('/voters', { signal });
}

export type VotingStatusDto = { defile: boolean; photos: boolean };

export async function getVotingStatus(signal?: AbortSignal): Promise<VotingStatusDto> {
  return await cachedGet<VotingStatusDto>('/voting-status', { signal, cacheTtl: 5_000 });
}
