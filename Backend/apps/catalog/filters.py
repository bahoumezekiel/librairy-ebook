"""Filtres du catalogue : catégorie, gratuit ou payant, recherche plein texte, tri."""

from django.contrib.postgres.search import SearchQuery, SearchRank
from django.db.models import F
from django_filters import rest_framework as filters

from .models import SEARCH_CONFIG, Book

# Tris proposés. Sans tri, les livres sont listés du plus récent au plus ancien.
# Les livres sans note et les livres gratuits (sans prix) sont placés du côté logique.
SORTS = {
    "rating": [F("rating_average").desc(nulls_last=True), "-rating_count"],
    "price_asc": [F("price").asc(nulls_first=True)],
    "price_desc": [F("price").desc(nulls_last=True)],
}


class BookFilter(filters.FilterSet):
    """Filtres d'une liste de livres enrichie par `Book.objects.with_ratings()`."""

    category = filters.CharFilter(field_name="category__slug")
    is_free = filters.BooleanFilter(field_name="price", lookup_expr="isnull")
    search = filters.CharFilter(method="filter_search")
    # Déclaré après `search` : un tri explicite l'emporte sur le tri par pertinence.
    sort = filters.ChoiceFilter(choices=[(key, key) for key in SORTS], method="apply_sort")

    class Meta:
        model = Book
        fields = ["category", "is_free", "search", "sort"]

    def filter_search(self, queryset, name, value):
        """Recherche dans le titre, l'auteur et la description, du plus au moins pertinent."""
        query = SearchQuery(value, config=SEARCH_CONFIG, search_type="websearch")
        return (
            queryset.filter(search_vector=query)
            .annotate(rank=SearchRank(F("search_vector"), query))
            .order_by("-rank", *Book._meta.ordering)
        )

    def apply_sort(self, queryset, name, value):
        return queryset.order_by(*SORTS[value], *Book._meta.ordering)
