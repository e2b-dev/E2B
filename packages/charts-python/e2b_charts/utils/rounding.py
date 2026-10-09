from decimal import Decimal, localcontext


def dynamic_round(number):
    # Convert to Decimal for precise control
    decimal_number = Decimal(str(number))

    # Dynamically determine precision based on magnitude
    precision = max(1, 8 - decimal_number.adjusted())  # 8 digits of precision

    with localcontext() as ctx:
        ctx.prec = precision  # Set the dynamic precision
        return +decimal_number  # The + operator applies rounding
