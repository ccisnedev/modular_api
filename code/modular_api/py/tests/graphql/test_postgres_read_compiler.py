"""PostgreSQL read compiler tests: exact SQL and parameter assertions for every pattern it emits."""

from __future__ import annotations

import pytest

from modular_api.graphql import (
    GraphqlCatalog,
    GraphqlCatalogBuild,
    GraphqlCatalogBuildMode,
    GraphqlCatalogCapabilities,
    GraphqlCatalogField,
    GraphqlCatalogFieldVisibility,
    GraphqlCatalogGraphqlNames,
    GraphqlCatalogIdentity,
    GraphqlCatalogIdentityMode,
    GraphqlCatalogOrigin,
    GraphqlCatalogPagination,
    GraphqlCatalogPaginationMode,
    GraphqlCatalogProvider,
    GraphqlCatalogRelation,
    GraphqlCatalogRelationCardinality,
    GraphqlCatalogSource,
    GraphqlPublishedObject,
    PostgresReadCompiler,
    SqlCollectionSelection,
    SqlCountSelection,
    SqlFilterCondition,
    SqlFilterGroup,
    SqlFilterOperator,
    SqlItemSelection,
    SqlOrderByClause,
    SqlPage,
    SqlReadCommand,
    SqlReadCommandPurpose,
    SqlRelationBatchSelection,
    SqlSortDirection,
)
from modular_api.graphql.read import SqlFilterNode
from modular_api.graphql.sqlserver import PhysicalObjectKind

_COMPILER = PostgresReadCompiler()

_SELECT = 'SELECT "CustomerId" AS "customerId", "CustomerCode" AS "customerCode" FROM "sales"."Customer"'


def _values(command: SqlReadCommand) -> list[object]:
    return [parameter.value for parameter in command.parameters]


def _names(command: SqlReadCommand) -> list[str]:
    return [parameter.name for parameter in command.parameters]


def _collection(
    filter_: SqlFilterNode | None,
    order_by: tuple[SqlOrderByClause, ...] = (),
    page: SqlPage | None = None,
) -> SqlReadCommand:
    return _COMPILER.compile_collection(
        catalog=_catalog(),
        selection=SqlCollectionSelection(
            object_id="sales.Customer",
            projected_fields=("customerId", "customerCode"),
            filter=filter_,
            order_by=order_by,
            page=page,
        ),
    )


def _cond(field: str, operator: SqlFilterOperator, value: object) -> SqlFilterCondition:
    return SqlFilterCondition(field=field, operator=operator, value=value)


def test_item_with_single_key() -> None:
    command = _COMPILER.compile_item(
        catalog=_catalog(),
        selection=SqlItemSelection(
            object_id="sales.Customer",
            projected_fields=("customerId", "customerCode"),
            key={"customerId": 42},
        ),
    )

    assert command.engine == "postgres"
    assert command.purpose is SqlReadCommandPurpose.ITEM
    assert command.sql == f'{_SELECT} WHERE "CustomerId" = $1 LIMIT 1'
    assert _values(command) == [42]
    assert _names(command) == ["p1"]
    assert command.parameters[0].type == "Int"


def test_item_with_composite_key() -> None:
    command = _COMPILER.compile_item(
        catalog=_catalog(),
        selection=SqlItemSelection(
            object_id="sales.OrderLine",
            projected_fields=("quantity",),
            key={"lineNo": 3, "orderId": 7},
        ),
    )

    assert command.sql == (
        'SELECT "Quantity" AS "quantity" FROM "sales"."OrderLine" '
        'WHERE "OrderId" = $1 AND "LineNo" = $2 LIMIT 1'
    )
    assert _values(command) == [7, 3]
    assert _names(command) == ["p1", "p2"]


def test_item_missing_key_component_is_rejected() -> None:
    with pytest.raises(ValueError):
        _COMPILER.compile_item(
            catalog=_catalog(),
            selection=SqlItemSelection(
                object_id="sales.OrderLine", projected_fields=("quantity",), key={"orderId": 7}
            ),
        )


def test_collection_without_filter_order_or_page() -> None:
    command = _collection(None)

    assert command.engine == "postgres"
    assert command.purpose is SqlReadCommandPurpose.COLLECTION
    assert command.sql == _SELECT
    assert command.parameters == ()


@pytest.mark.parametrize(
    ("operator", "sql_operator"),
    [
        (SqlFilterOperator.EQ, "="),
        (SqlFilterOperator.NE, "<>"),
        (SqlFilterOperator.LT, "<"),
        (SqlFilterOperator.LTE, "<="),
        (SqlFilterOperator.GT, ">"),
        (SqlFilterOperator.GTE, ">="),
    ],
)
def test_comparison_operators(operator: SqlFilterOperator, sql_operator: str) -> None:
    command = _collection(_cond("customerId", operator, 10))

    assert command.sql == f'{_SELECT} WHERE "CustomerId" {sql_operator} $1'
    assert _values(command) == [10]


def test_in_list() -> None:
    command = _collection(_cond("customerId", SqlFilterOperator.IN_LIST, [1, 2, 3]))

    assert command.sql == f'{_SELECT} WHERE "CustomerId" IN ($1, $2, $3)'
    assert _values(command) == [1, 2, 3]
    assert _names(command) == ["p1", "p2", "p3"]


def test_in_list_empty_matches_nothing() -> None:
    command = _collection(_cond("customerId", SqlFilterOperator.IN_LIST, []))

    assert command.sql == f"{_SELECT} WHERE 1 = 0"
    assert command.parameters == ()


def test_is_null_true_and_false() -> None:
    assert _collection(_cond("customerCode", SqlFilterOperator.IS_NULL, True)).sql == (
        f'{_SELECT} WHERE "CustomerCode" IS NULL'
    )
    assert _collection(_cond("customerCode", SqlFilterOperator.IS_NULL, False)).sql == (
        f'{_SELECT} WHERE "CustomerCode" IS NOT NULL'
    )


def test_is_null_requires_a_boolean() -> None:
    with pytest.raises(ValueError):
        _collection(_cond("customerCode", SqlFilterOperator.IS_NULL, "yes"))


@pytest.mark.parametrize("operator", [SqlFilterOperator.EQ, SqlFilterOperator.NE])
def test_eq_and_ne_null_are_rejected(operator: SqlFilterOperator) -> None:
    with pytest.raises(ValueError):
        _collection(_cond("customerCode", operator, None))


def test_contains() -> None:
    command = _collection(_cond("customerCode", SqlFilterOperator.CONTAINS, "ACME"))

    assert command.sql == f"""{_SELECT} WHERE "CustomerCode" LIKE '%' || $1 || '%' ESCAPE '\\'"""
    assert _values(command) == ["ACME"]


def test_starts_with() -> None:
    command = _collection(_cond("customerCode", SqlFilterOperator.STARTS_WITH, "AC"))

    assert command.sql == f"""{_SELECT} WHERE "CustomerCode" LIKE $1 || '%' ESCAPE '\\'"""
    assert _values(command) == ["AC"]


def test_ends_with() -> None:
    command = _collection(_cond("customerCode", SqlFilterOperator.ENDS_WITH, "ME"))

    assert command.sql == f"""{_SELECT} WHERE "CustomerCode" LIKE '%' || $1 ESCAPE '\\'"""
    assert _values(command) == ["ME"]


@pytest.mark.parametrize(
    ("raw", "escaped"),
    [
        ("100%", "100\\%"),
        ("a_b", "a\\_b"),
        ("c:\\dir", "c:\\\\dir"),
        ("%_\\", "\\%\\_\\\\"),
        ("plain", "plain"),
    ],
)
@pytest.mark.parametrize(
    "operator",
    [SqlFilterOperator.CONTAINS, SqlFilterOperator.STARTS_WITH, SqlFilterOperator.ENDS_WITH],
)
def test_like_operators_escape_wildcards_in_the_bound_value(
    operator: SqlFilterOperator, raw: str, escaped: str
) -> None:
    command = _collection(_cond("customerCode", operator, raw))

    assert _values(command) == [escaped]
    assert "ESCAPE" in command.sql


def test_nested_and_or_not() -> None:
    command = _collection(
        SqlFilterGroup.and_(
            (
                _cond("customerId", SqlFilterOperator.GT, 5),
                SqlFilterGroup.or_(
                    (
                        _cond("customerCode", SqlFilterOperator.STARTS_WITH, "A"),
                        SqlFilterGroup.not_(_cond("customerCode", SqlFilterOperator.IS_NULL, True)),
                    )
                ),
            )
        )
    )

    assert command.sql == (
        f"""{_SELECT} WHERE ("CustomerId" > $1 AND ("CustomerCode" LIKE $2 || '%' ESCAPE '\\' """
        f'OR NOT ("CustomerCode" IS NULL)))'
    )
    assert _values(command) == [5, "A"]
    assert _names(command) == ["p1", "p2"]


def test_empty_groups_add_no_where() -> None:
    assert _collection(SqlFilterGroup.and_(())).sql == _SELECT


def test_multi_field_order_by() -> None:
    command = _collection(
        None,
        order_by=(
            SqlOrderByClause(field="customerCode", direction=SqlSortDirection.ASC),
            SqlOrderByClause(field="customerId", direction=SqlSortDirection.DESC),
        ),
    )

    assert command.sql == f'{_SELECT} ORDER BY "CustomerCode" ASC, "CustomerId" DESC'


def test_paging_binds_limit_then_offset_in_placeholder_order() -> None:
    command = _collection(
        _cond("customerId", SqlFilterOperator.GT, 5),
        order_by=(SqlOrderByClause(field="customerId", direction=SqlSortDirection.ASC),),
        page=SqlPage(limit=25, offset=50),
    )

    assert command.sql == (
        f'{_SELECT} WHERE "CustomerId" > $1 ORDER BY "CustomerId" ASC LIMIT $2 OFFSET $3'
    )
    assert _values(command) == [5, 25, 50]
    assert _names(command) == ["p1", "p2", "p3"]


def test_count_without_filter() -> None:
    command = _COMPILER.compile_count(
        catalog=_catalog(), selection=SqlCountSelection(object_id="sales.Customer")
    )

    assert command.engine == "postgres"
    assert command.purpose is SqlReadCommandPurpose.COUNT
    assert command.sql == 'SELECT COUNT(*) AS "totalCount" FROM "sales"."Customer"'
    assert command.parameters == ()


def test_count_with_filter() -> None:
    command = _COMPILER.compile_count(
        catalog=_catalog(),
        selection=SqlCountSelection(
            object_id="sales.Customer",
            filter=_cond("isActive", SqlFilterOperator.EQ, True),
        ),
    )

    assert command.sql == 'SELECT COUNT(*) AS "totalCount" FROM "sales"."Customer" WHERE "IsActive" = $1'
    assert _values(command) == [True]


def test_relation_batch_single_key() -> None:
    command = _COMPILER.compile_relation_batch(
        catalog=_catalog(),
        selection=SqlRelationBatchSelection(
            source_object_id="sales.Order",
            relation_name="customer",
            projected_fields=("customerId", "customerCode"),
            parent_keys=({"customerId": 1}, {"customerId": 2}),
        ),
    )

    assert command.engine == "postgres"
    assert command.purpose is SqlReadCommandPurpose.RELATION_BATCH
    assert command.sql == f'{_SELECT} WHERE "CustomerId" IN ($1, $2)'
    assert _values(command) == [1, 2]


def test_relation_batch_composite_key() -> None:
    command = _COMPILER.compile_relation_batch(
        catalog=_catalog(),
        selection=SqlRelationBatchSelection(
            source_object_id="sales.OrderHeader",
            relation_name="lines",
            projected_fields=("quantity",),
            parent_keys=({"orderId": 1, "lineNo": 10}, {"orderId": 2, "lineNo": 20}),
        ),
    )

    assert command.sql == (
        'SELECT "Quantity" AS "quantity" FROM "sales"."OrderLine" '
        'WHERE ("OrderId" = $1 AND "LineNo" = $2) OR ("OrderId" = $3 AND "LineNo" = $4)'
    )
    assert _values(command) == [1, 10, 2, 20]
    assert _names(command) == ["p1", "p2", "p3", "p4"]


def test_relation_batch_without_parents_matches_nothing() -> None:
    command = _COMPILER.compile_relation_batch(
        catalog=_catalog(),
        selection=SqlRelationBatchSelection(
            source_object_id="sales.Order",
            relation_name="customer",
            projected_fields=("customerId",),
            parent_keys=(),
        ),
    )

    assert command.sql == 'SELECT "CustomerId" AS "customerId" FROM "sales"."Customer" WHERE 1 = 0'


def test_unknown_relation_is_rejected() -> None:
    with pytest.raises(ValueError):
        _COMPILER.compile_relation_batch(
            catalog=_catalog(),
            selection=SqlRelationBatchSelection(
                source_object_id="sales.Order",
                relation_name="nope",
                projected_fields=("customerId",),
                parent_keys=(),
            ),
        )


def test_identifiers_are_quoted_with_embedded_quotes_doubled_and_case_kept() -> None:
    command = _COMPILER.compile_item(
        catalog=_catalog(),
        selection=SqlItemSelection(
            object_id='we"ird.Mixed"Case',
            projected_fields=("oddName",),
            key={"id": 1},
        ),
    )

    assert command.sql == (
        'SELECT "Odd""Col" AS "oddName" FROM "we""ird"."Mixed""Case" WHERE "Id" = $1 LIMIT 1'
    )


# ---------------------------------------------------------------------------------------------------
# Catalog fixture
# ---------------------------------------------------------------------------------------------------


def _field(column: str, public_name: str, type_: str) -> GraphqlCatalogField:
    return GraphqlCatalogField(
        column=column,
        public_name=public_name,
        type=type_,
        nullable=False,
        visibility=GraphqlCatalogFieldVisibility.PUBLIC,
        filterable=True,
        sortable=True,
        sensitive=False,
        origin=GraphqlCatalogOrigin.INFERRED,
    )


def _object(
    *,
    object_id: str,
    schema: str,
    name: str,
    type_name: str,
    key: tuple[str, ...],
    fields: tuple[GraphqlCatalogField, ...],
    relations: tuple[GraphqlCatalogRelation, ...] = (),
) -> GraphqlPublishedObject:
    return GraphqlPublishedObject(
        id=object_id,
        kind=PhysicalObjectKind.TABLE,
        readonly=True,
        source=GraphqlCatalogSource(schema_name=schema, object_name=name),
        graphql=GraphqlCatalogGraphqlNames(
            type_name=type_name,
            collection_field=f"{type_name}List",
            item_field=type_name,
        ),
        identity=GraphqlCatalogIdentity(
            mode=GraphqlCatalogIdentityMode.SINGLE if len(key) == 1 else GraphqlCatalogIdentityMode.COMPOSITE,
            fields=key,
            origin=GraphqlCatalogOrigin.INFERRED,
        ),
        fields=fields,
        relations=relations,
        capabilities=GraphqlCatalogCapabilities(
            item=True,
            collection=True,
            filter=True,
            sort=True,
            pagination=GraphqlCatalogPagination(
                mode=GraphqlCatalogPaginationMode.OFFSET, default_limit=25, max_limit=100
            ),
        ),
    )


def _relation(
    name: str, target: str, source: tuple[str, ...], target_fields: tuple[str, ...]
) -> GraphqlCatalogRelation:
    return GraphqlCatalogRelation(
        name=name,
        target=target,
        cardinality=GraphqlCatalogRelationCardinality.MANY,
        source_fields=source,
        target_fields=target_fields,
        origin=GraphqlCatalogOrigin.INFERRED,
    )


def _catalog() -> GraphqlCatalog:
    return GraphqlCatalog(
        catalog_version="1.0.0",
        provider=GraphqlCatalogProvider(kind="sql", engine="postgres", provider_version="test"),
        build=GraphqlCatalogBuild(
            mode=GraphqlCatalogBuildMode.RUNTIME, source_root="db/src", source_digest="test-digest"
        ),
        objects=(
            _object(
                object_id="sales.Customer",
                schema="sales",
                name="Customer",
                type_name="CustomerRecord",
                key=("CustomerId",),
                fields=(
                    _field("CustomerCode", "customerCode", "String"),
                    _field("CustomerId", "customerId", "Int"),
                    _field("IsActive", "isActive", "Boolean"),
                ),
            ),
            _object(
                object_id="sales.Order",
                schema="sales",
                name="Order",
                type_name="OrderRecord",
                key=("OrderId",),
                fields=(_field("OrderId", "orderId", "Int"), _field("CustomerId", "customerId", "Int")),
                relations=(_relation("customer", "sales.Customer", ("CustomerId",), ("CustomerId",)),),
            ),
            _object(
                object_id="sales.OrderHeader",
                schema="sales",
                name="OrderHeader",
                type_name="OrderHeaderRecord",
                key=("OrderId", "LineNo"),
                fields=(_field("OrderId", "orderId", "Int"), _field("LineNo", "lineNo", "Int")),
                relations=(
                    _relation("lines", "sales.OrderLine", ("OrderId", "LineNo"), ("OrderId", "LineNo")),
                ),
            ),
            _object(
                object_id="sales.OrderLine",
                schema="sales",
                name="OrderLine",
                type_name="OrderLineRecord",
                key=("OrderId", "LineNo"),
                fields=(
                    _field("OrderId", "orderId", "Int"),
                    _field("LineNo", "lineNo", "Int"),
                    _field("Quantity", "quantity", "Int"),
                ),
            ),
            _object(
                object_id='we"ird.Mixed"Case',
                schema='we"ird',
                name='Mixed"Case',
                type_name="Weird",
                key=("Id",),
                fields=(_field("Id", "id", "Int"), _field('Odd"Col', "oddName", "String")),
            ),
        ),
        diagnostics=(),
    )
