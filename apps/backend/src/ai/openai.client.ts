// @MX:WARN: 외부 API 호출 + 비용 발생
// @MX:REASON: 30초 timeout, max_tokens 4096, NFR-PROG-PERF-006 + NFR-PROG-AI-COST-003
import {
  BadGatewayException,
  GatewayTimeoutException,
  Injectable,
  Logger,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { CreateAiProgramDto } from './dto/create-ai-program.dto';

export interface OpenAiExerciseHint {
  id: string;
  name: string;
}

@Injectable()
export class OpenAiClient {
  private readonly logger = new Logger(OpenAiClient.name);
  private client: OpenAI | null = null;

  constructor(private readonly configService: ConfigService) {}

  private getClient(): OpenAI {
    if (!this.client) {
      const apiKey = this.configService.get<string>('OPENAI_API_KEY');
      if (!apiKey) {
        throw new BadGatewayException('OPENAI_API_KEY가 설정되지 않음');
      }
      this.client = new OpenAI({ apiKey, timeout: 30000 });
    }
    return this.client;
  }

  async generateProgram(
    dto: CreateAiProgramDto,
    exercises: OpenAiExerciseHint[],
  ): Promise<unknown> {
    const systemPrompt = [
      '당신은 근력 운동 프로그램 설계자입니다.',
      '반드시 다음 JSON 스키마만 응답하세요 (다른 텍스트 금지):',
      '{"title":"string","description":"string","level":"beginner|intermediate|advanced",',
      '"days":[{"dayNumber":number,"name":"string","exercises":[{"exerciseId":"string","orderIndex":number,"sets":number,"reps":"string","weightNote":"string|null"}]}]}',
      'exerciseId는 반드시 다음 목록에서 선택:',
      JSON.stringify(exercises),
    ].join('\n');

    const userMessage = [
      `목표: ${dto.goal}`,
      `주 ${dto.daysPerWeek}일 운동`,
      `보유 장비: ${dto.availableEquipment.join(', ')}`,
      dto.focusAreas && dto.focusAreas.length > 0
        ? `집중 부위: ${dto.focusAreas.join(', ')}`
        : '',
    ]
      .filter(Boolean)
      .join('\n');

    let text: string | null;
    try {
      const completion = await this.getClient().chat.completions.create({
        model: 'gpt-4o-mini',
        max_tokens: 4096,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
      });
      text = completion.choices[0]?.message?.content ?? null;
    } catch (err: any) {
      this.logger.error('OpenAI API 호출 실패', err?.stack || err);
      if (this.isTimeoutError(err)) {
        throw new GatewayTimeoutException('AI 응답 시간 초과');
      }
      throw new BadGatewayException('AI 호출 실패');
    }

    if (!text) {
      throw new UnprocessableEntityException('AI 응답에 텍스트가 없습니다');
    }

    // OpenAI가 JSON을 마크다운 코드블록으로 감쌀 경우 제거
    const cleaned = text
      .replace(/^```(?:json)?\n?/, '')
      .replace(/\n?```$/, '')
      .trim();

    try {
      return JSON.parse(cleaned);
    } catch {
      throw new UnprocessableEntityException('AI 응답 JSON 파싱 실패');
    }
  }

  private isTimeoutError(err: any): boolean {
    if (!err) return false;
    const name = String(err?.name || '');
    const msg = String(err?.message || '');
    return (
      name === 'APIConnectionTimeoutError' ||
      name === 'APITimeoutError' ||
      name === 'AbortError' ||
      msg.toLowerCase().includes('timeout')
    );
  }
}
