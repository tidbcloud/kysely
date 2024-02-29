import { ExpressionBuilder, ReferenceExpression } from 'kysely';

type VectorLike = Float32Array | number[];

export function l1Distance<DB, TB extends keyof DB, RE extends ReferenceExpression<DB, TB> = ReferenceExpression<DB, TB>>(
  eb: ExpressionBuilder<DB, TB>,
  column: RE,
  value: VectorLike
) {
  return eb.fn<number>('VEC_L1_DISTANCE', [column, (eb) => eb.val(vectorToSql(value))]);
}

export function l2Distance<DB, TB extends keyof DB, RE extends ReferenceExpression<DB, TB> = ReferenceExpression<DB, TB>>(
  eb: ExpressionBuilder<DB, TB>,
  column: RE,
  value: VectorLike
) {
  return eb.fn<number>('VEC_L2_DISTANCE', [column, (eb) => eb.val(vectorToSql(value))]);
}

export function negativeInnerProduct<
  DB,
  TB extends keyof DB,
  RE extends ReferenceExpression<DB, TB> = ReferenceExpression<DB, TB>
>(eb: ExpressionBuilder<DB, TB>, column: RE, value: VectorLike) {
  return eb.fn<number>('VEC_NEGATIVE_INNER_PRODUCT', [column, (eb) => eb.val(vectorToSql(value))]);
}

export function innerProduct<DB, TB extends keyof DB, RE extends ReferenceExpression<DB, TB> = ReferenceExpression<DB, TB>>(
  eb: ExpressionBuilder<DB, TB>,
  column: RE,
  value: VectorLike
) {
  return eb.neg(negativeInnerProduct(eb, column, value));
}

export function cosineDistance<DB, TB extends keyof DB, RE extends ReferenceExpression<DB, TB> = ReferenceExpression<DB, TB>>(
  eb: ExpressionBuilder<DB, TB>,
  column: RE,
  value: VectorLike
) {
  return eb.fn<number>('VEC_COSINE_DISTANCE', [column, (eb) => eb.val(vectorToSql(value))]);
}

export function cosineSimilarity<DB, TB extends keyof DB, RE extends ReferenceExpression<DB, TB> = ReferenceExpression<DB, TB>>(
  eb: ExpressionBuilder<DB, TB>,
  column: RE,
  value: VectorLike
) {
  return eb(eb.lit<number>(1), '-', cosineDistance(eb, column, value));
}

export function vectorFromSql(value: string) {
  return value
    .substring(1, value.length - 1)
    .split(',')
    .map((v) => parseFloat(v));
}

export function vectorToSql(vector: VectorLike) {
  return `[${vector.join(',')}]`;
}
