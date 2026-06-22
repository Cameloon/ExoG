package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
)

type RawChange struct {
	SpeciesListingName    string `json:"species_listing_name"`
	ChangeTypeName        string `json:"change_type_name"`
	EffectiveAtFormatted  string `json:"effective_at_formatted"`
	IsCurrent             bool   `json:"is_current"`
	AutoNote              any    `json:"auto_note"`
}

type RawEntry struct {
	ID                    int         `json:"id"`
	FullName              string      `json:"full_name"`
	RankName              string      `json:"rank_name"`
	ClassName             any         `json:"class_name"`
	OrderName             any         `json:"order_name"`
	FamilyName            any         `json:"family_name"`
	GenusName             any         `json:"genus_name"`
	SpeciesName           any         `json:"species_name"`
	CitesAccepted         bool        `json:"cites_accepted"`
	EnglishNames          []string    `json:"english_names"`
	CurrentListing        any         `json:"current_listing"`
	CurrentListingChanges []RawChange `json:"current_listing_changes"`
}

type CleanChange struct {
	SpeciesListingName    string `json:"species_listing_name"`
	ChangeTypeName        string `json:"change_type_name"`
	EffectiveAtFormatted  string `json:"effective_at_formatted"`
	IsCurrent             bool   `json:"is_current"`
	AutoNote              any    `json:"auto_note"`
}

type CleanEntry struct {
	ID             int           `json:"id"`
	FullName       string        `json:"full_name"`
	Rank           string        `json:"rank"`
	ClassName      any           `json:"class_name"`
	OrderName      any           `json:"order_name"`
	FamilyName     any           `json:"family_name"`
	GenusName      any           `json:"genus_name"`
	SpeciesName    any           `json:"species_name"`
	CitesAccepted  bool          `json:"cites_accepted"`
	EnglishNames   []string      `json:"english_names"`
	CurrentListing any           `json:"current_listing"`
	ListingChanges []CleanChange `json:"listing_changes"`
}

func nillify(v any) any {
	s, ok := v.(string)
	if ok && s == "" {
		return nil
	}
	return v
}

func main() {
	// Find project root from cwd by walking up until we find scripts/
	cwd, _ := os.Getwd()
	root := cwd
	for {
		if _, err := os.Stat(filepath.Join(root, "scripts")); err == nil {
			break
		}
		parent := filepath.Dir(root)
		if parent == root {
			fmt.Fprintln(os.Stderr, "cannot find project root (no scripts/ directory)")
			os.Exit(1)
		}
		root = parent
	}

	src := filepath.Join(root, "src", "assets", "Index_of_CITES_Species_2026-06-06 15_05.json")
	dst := filepath.Join(root, "scripts", "data", "cites_species_cleaned.json")

	raw, err := os.ReadFile(src)
	if err != nil {
		fmt.Fprintf(os.Stderr, "error reading source: %v\n", err)
		os.Exit(1)
	}

	var entries []RawEntry
	if err := json.Unmarshal(raw, &entries); err != nil {
		fmt.Fprintf(os.Stderr, "error parsing JSON: %v\n", err)
		os.Exit(1)
	}

	cleaned := make([]CleanEntry, 0, len(entries))
	for _, e := range entries {
		changes := make([]CleanChange, 0, len(e.CurrentListingChanges))
		for _, c := range e.CurrentListingChanges {
			changes = append(changes, CleanChange{
				SpeciesListingName:    c.SpeciesListingName,
				ChangeTypeName:        c.ChangeTypeName,
				EffectiveAtFormatted:  c.EffectiveAtFormatted,
				IsCurrent:             c.IsCurrent,
				AutoNote:              nillify(c.AutoNote),
			})
		}

		cleaned = append(cleaned, CleanEntry{
			ID:             e.ID,
			FullName:       e.FullName,
			Rank:           e.RankName,
			ClassName:      nillify(e.ClassName),
			OrderName:      nillify(e.OrderName),
			FamilyName:     nillify(e.FamilyName),
			GenusName:      nillify(e.GenusName),
			SpeciesName:    nillify(e.SpeciesName),
			CitesAccepted:  e.CitesAccepted,
			EnglishNames:   e.EnglishNames,
			CurrentListing: nillify(e.CurrentListing),
			ListingChanges: changes,
		})
	}

	out, err := json.Marshal(cleaned)
	if err != nil {
		fmt.Fprintf(os.Stderr, "error encoding JSON: %v\n", err)
		os.Exit(1)
	}

	if err := os.MkdirAll(filepath.Dir(dst), 0755); err != nil {
		fmt.Fprintf(os.Stderr, "error creating output dir: %v\n", err)
		os.Exit(1)
	}

	if err := os.WriteFile(dst, out, 0644); err != nil {
		fmt.Fprintf(os.Stderr, "error writing output: %v\n", err)
		os.Exit(1)
	}

	rawInfo, _ := os.Stat(src)
	dstInfo, _ := os.Stat(dst)
	ratio := float64(rawInfo.Size()) / float64(dstInfo.Size())

	fmt.Printf("Cleaned %d entries → %s\n", len(cleaned), dst)
	fmt.Printf("Size: %.2f MB (%d entries)\n", float64(dstInfo.Size())/1024/1024, len(cleaned))
	fmt.Printf("Compression ratio: %.1fx\n", ratio)
}
