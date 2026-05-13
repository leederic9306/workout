// 운동 프로그램 시스템 서비스 (SPEC-PROGRAM-001)
import { api } from './api';
import type {
  CatalogResponseDto,
  ProgramDetailDto,
  ActiveProgramResponseDto,
  ActivateProgramResponseDto,
  CreateAiProgramRequest,
} from '@workout/types';

export async function fetchCatalog(): Promise<CatalogResponseDto> {
  const { data } = await api.get('/programs/catalog');
  return data;
}

export async function fetchProgramDetail(id: string): Promise<ProgramDetailDto> {
  const { data } = await api.get(`/programs/${id}`);
  return data;
}

export async function fetchActiveProgram(): Promise<ActiveProgramResponseDto> {
  const { data } = await api.get('/programs/active');
  return data;
}

export async function activateProgram(id: string): Promise<ActivateProgramResponseDto> {
  const { data } = await api.post(`/programs/${id}/activate`);
  return data;
}

export async function deactivateProgram(): Promise<void> {
  await api.delete('/programs/active');
}

// @MX:NOTE: [AUTO] AI 프로그램 생성은 LLM 응답 대기 시간이 길어 별도 타임아웃(35s) 사용
export async function createAiProgram(dto: CreateAiProgramRequest): Promise<ProgramDetailDto> {
  const { data } = await api.post('/ai/programs', dto, { timeout: 35_000 });
  return data;
}
