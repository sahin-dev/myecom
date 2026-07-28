import { IsString } from "class-validator";

export class InitiateBkashDto {
  @IsString()
  orderId!: string;
}

export class ExecuteBkashDto {
  @IsString()
  paymentID!: string;
}
