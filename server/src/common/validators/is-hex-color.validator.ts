import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

const HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/;

@ValidatorConstraint({ name: 'isHexColor', async: false })
export class IsHexColorConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return typeof value === 'string' && HEX_COLOR_REGEX.test(value);
  }

  defaultMessage(): string {
    return 'color must be a valid hex color in #RRGGBB format';
  }
}

export function IsHexColor(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsHexColorConstraint,
    });
  };
}
