import { IsEmail, IsIn, IsString, Length, Matches } from 'class-validator';

export const campaignTiers = {
  seed: { label: 'Seed the garden', selectedAmount: 5_000, displayAmount: 'GHS 50' },
  grower: { label: 'Help it grow', selectedAmount: 10_000, displayAmount: 'GHS 100' },
  steward: { label: 'Become a steward', selectedAmount: 25_000, displayAmount: 'GHS 250' },
} as const;

export type CampaignTier = keyof typeof campaignTiers;

export class CheckoutDto {
  @IsString()
  @Length(2, 120)
  name!: string;

  @IsEmail()
  @Length(3, 254)
  email!: string;

  @IsString()
  @Matches(/^\+[1-9][0-9]{7,14}$/)
  phone!: string;

  @IsIn(Object.keys(campaignTiers))
  tier!: CampaignTier;

  @IsString()
  @Matches(/^[A-Za-z0-9_-]{8,100}$/)
  attempt_id!: string;
}
