// 운동 세션 React Query 훅
import {
  useInfiniteQuery,
  useQuery,
  useMutation,
  useQueryClient,
  InfiniteData,
} from '@tanstack/react-query';
import type {
  PaginatedSessionsResponse,
  WorkoutSessionDetail,
  ActiveSessionResponse,
} from '@workout/types';
import {
  createSession,
  getActiveSession,
  listSessions,
  getSession,
  completeSession,
  deleteSession,
  addSet,
  updateSet,
  deleteSet,
  ListSessionsQuery,
  CreateSessionRequest,
  AddSetRequest,
  UpdateSetRequest,
} from '../services/workouts';

const ACTIVE_KEY = ['workouts', 'active'];
const SESSIONS_KEY = ['workouts', 'sessions'];

export function useActiveSession() {
  return useQuery<ActiveSessionResponse, Error>({
    queryKey: ACTIVE_KEY,
    queryFn: getActiveSession,
  });
}

export function useSessions(query: Omit<ListSessionsQuery, 'page'> = {}) {
  return useInfiniteQuery<
    PaginatedSessionsResponse,
    Error,
    InfiniteData<PaginatedSessionsResponse>,
    string[],
    number
  >({
    queryKey: [...SESSIONS_KEY, JSON.stringify(query)],
    queryFn: ({ pageParam }) => listSessions({ ...query, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page < last.totalPages ? last.page + 1 : undefined),
  });
}

export function useSession(id: string) {
  return useQuery<WorkoutSessionDetail, Error>({
    queryKey: ['workouts', 'session', id],
    queryFn: () => getSession(id),
    enabled: !!id,
  });
}

export function useCreateSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (req: CreateSessionRequest) => createSession(req),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ACTIVE_KEY });
      qc.invalidateQueries({ queryKey: SESSIONS_KEY });
    },
  });
}

export function useCompleteSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => completeSession(id),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ACTIVE_KEY });
      qc.invalidateQueries({ queryKey: SESSIONS_KEY });
      qc.invalidateQueries({ queryKey: ['workouts', 'session', id] });
    },
  });
}

export function useDeleteSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteSession(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: SESSIONS_KEY });
      qc.invalidateQueries({ queryKey: ACTIVE_KEY });
    },
  });
}

function invalidateSessionCaches(qc: ReturnType<typeof useQueryClient>, sessionId: string) {
  qc.invalidateQueries({ queryKey: ['workouts', 'session', sessionId] });
  qc.invalidateQueries({ queryKey: ACTIVE_KEY });
}

export function useAddSet(sessionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (req: AddSetRequest) => addSet(sessionId, req),
    onSuccess: () => invalidateSessionCaches(qc, sessionId),
  });
}

export function useUpdateSet(sessionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ setId, req }: { setId: string; req: UpdateSetRequest }) =>
      updateSet(sessionId, setId, req),
    onSuccess: () => invalidateSessionCaches(qc, sessionId),
  });
}

export function useDeleteSet(sessionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (setId: string) => deleteSet(sessionId, setId),
    onSuccess: () => invalidateSessionCaches(qc, sessionId),
  });
}
